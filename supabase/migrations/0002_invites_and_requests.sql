-- ============================================================================
-- Invite links + join requests
--   * group_invites: a shareable token. The link is /join/<token>.
--   * join_requests: opening a link creates a PENDING request (no auto-join).
--     Existing group members approve or reject it.
-- Run this in the Supabase SQL Editor after 0001_init.sql.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- group_invites: one (or more) shareable tokens per group
-- ---------------------------------------------------------------------------
create table if not exists public.group_invites (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups (id) on delete cascade,
  token       uuid not null default gen_random_uuid() unique,
  created_by  uuid not null references public.profiles (id),
  created_at  timestamptz not null default now()
);
create index if not exists idx_group_invites_group on public.group_invites (group_id);

-- ---------------------------------------------------------------------------
-- join_requests: a person's pending request to join a group
-- ---------------------------------------------------------------------------
create table if not exists public.join_requests (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  status      text not null default 'pending'
                check (status in ('pending', 'approved', 'rejected')),
  created_at  timestamptz not null default now(),
  decided_by  uuid references public.profiles (id),
  decided_at  timestamptz,
  unique (group_id, profile_id)
);
create index if not exists idx_join_requests_group on public.join_requests (group_id);
create index if not exists idx_join_requests_profile on public.join_requests (profile_id);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.group_invites enable row level security;
alter table public.join_requests enable row level security;

-- group_invites: members can read/create invites for their group. Non-members
-- never read this table directly; they resolve a token via resolve_invite().
drop policy if exists "invites_select_member" on public.group_invites;
create policy "invites_select_member" on public.group_invites
  for select to authenticated using (public.is_group_member(group_id));

drop policy if exists "invites_insert_member" on public.group_invites;
create policy "invites_insert_member" on public.group_invites
  for insert to authenticated
  with check (public.is_group_member(group_id) and created_by = auth.uid());

-- join_requests:
--   insert  -> a user may create a request for THEMSELVES.
--   select  -> requester sees their own; group members see their group's.
--   update  -> group members approve/reject (also handled by the RPC below).
--   delete  -> requester can cancel; group members can clear.
drop policy if exists "requests_insert_self" on public.join_requests;
create policy "requests_insert_self" on public.join_requests
  for insert to authenticated with check (profile_id = auth.uid());

drop policy if exists "requests_select" on public.join_requests;
create policy "requests_select" on public.join_requests
  for select to authenticated
  using (profile_id = auth.uid() or public.is_group_member(group_id));

drop policy if exists "requests_update_member" on public.join_requests;
create policy "requests_update_member" on public.join_requests
  for update to authenticated
  using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

drop policy if exists "requests_delete" on public.join_requests;
create policy "requests_delete" on public.join_requests
  for delete to authenticated
  using (profile_id = auth.uid() or public.is_group_member(group_id));

-- ============================================================================
-- Functions
-- ============================================================================

-- resolve_invite: turn a token into group info without exposing group_invites.
-- Any authenticated user holding a valid token can preview the group.
create or replace function public.resolve_invite(invite_token uuid)
returns table (group_id uuid, group_name text, group_emoji text, member_count bigint)
language sql
security definer set search_path = public
stable
as $$
  select g.id,
         g.name,
         g.emoji,
         (select count(*) from public.group_members gm where gm.group_id = g.id)
  from public.group_invites i
  join public.groups g on g.id = i.group_id
  where i.token = invite_token;
$$;
grant execute on function public.resolve_invite(uuid) to authenticated;

-- approve_join_request: atomically add the requester to the group and mark the
-- request approved. Only an existing group member may approve.
create or replace function public.approve_join_request(request_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  req public.join_requests%rowtype;
begin
  select * into req from public.join_requests where id = request_id;
  if req.id is null then
    raise exception 'Request not found';
  end if;
  if not public.is_group_member(req.group_id) then
    raise exception 'Only group members can approve requests';
  end if;

  insert into public.group_members (group_id, profile_id)
  values (req.group_id, req.profile_id)
  on conflict (group_id, profile_id) do nothing;

  update public.join_requests
     set status = 'approved', decided_by = auth.uid(), decided_at = now()
   where id = request_id;
end;
$$;
grant execute on function public.approve_join_request(uuid) to authenticated;
