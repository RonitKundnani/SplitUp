-- ============================================================================
-- SplitUp schema: profiles, groups, members, expenses, splits, settlements
-- Run this in the Supabase SQL Editor (or via the Supabase CLI).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, created automatically on signup.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text not null default '',
  created_at  timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- groups
-- ---------------------------------------------------------------------------
create table if not exists public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  emoji       text not null default '👥',
  created_by  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- group_members: which profiles belong to which group
-- ---------------------------------------------------------------------------
create table if not exists public.group_members (
  group_id    uuid not null references public.groups (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  joined_at   timestamptz not null default now(),
  primary key (group_id, profile_id)
);

-- Helper: is the current user a member of a given group?
-- SECURITY DEFINER avoids recursive RLS evaluation on group_members.
create or replace function public.is_group_member(gid uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and profile_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- expenses
-- ---------------------------------------------------------------------------
create table if not exists public.expenses (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.groups (id) on delete cascade,
  description  text not null,
  amount       numeric(12, 2) not null check (amount > 0),
  category     text not null default 'general',
  paid_by      uuid not null references public.profiles (id),
  created_by   uuid not null references public.profiles (id),
  spent_at     date not null default current_date,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- expense_splits: how much each member owes for a given expense
-- ---------------------------------------------------------------------------
create table if not exists public.expense_splits (
  id          uuid primary key default gen_random_uuid(),
  expense_id  uuid not null references public.expenses (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id),
  amount      numeric(12, 2) not null check (amount >= 0),
  unique (expense_id, profile_id)
);

-- ---------------------------------------------------------------------------
-- settlements: a payment from one member to another to clear debt
-- ---------------------------------------------------------------------------
create table if not exists public.settlements (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references public.groups (id) on delete cascade,
  from_profile  uuid not null references public.profiles (id),
  to_profile    uuid not null references public.profiles (id),
  amount        numeric(12, 2) not null check (amount > 0),
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists idx_group_members_profile on public.group_members (profile_id);
create index if not exists idx_expenses_group on public.expenses (group_id);
create index if not exists idx_splits_expense on public.expense_splits (expense_id);
create index if not exists idx_settlements_group on public.settlements (group_id);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.profiles        enable row level security;
alter table public.groups          enable row level security;
alter table public.group_members   enable row level security;
alter table public.expenses        enable row level security;
alter table public.expense_splits  enable row level security;
alter table public.settlements     enable row level security;

-- profiles: readable by any signed-in user (needed to show member names &
-- to look people up by email when adding them to a group). Self-update only.
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated using (true);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update to authenticated using (id = auth.uid());

-- groups: members can read; any authenticated user can create; creator manages.
drop policy if exists "groups_select_member" on public.groups;
create policy "groups_select_member" on public.groups
  for select to authenticated
  using (created_by = auth.uid() or public.is_group_member(id));

drop policy if exists "groups_insert" on public.groups;
create policy "groups_insert" on public.groups
  for insert to authenticated with check (created_by = auth.uid());

drop policy if exists "groups_update_creator" on public.groups;
create policy "groups_update_creator" on public.groups
  for update to authenticated using (created_by = auth.uid());

drop policy if exists "groups_delete_creator" on public.groups;
create policy "groups_delete_creator" on public.groups
  for delete to authenticated using (created_by = auth.uid());

-- group_members: members can see the roster; members can add others; you can
-- remove yourself and the group creator can remove anyone.
drop policy if exists "members_select" on public.group_members;
create policy "members_select" on public.group_members
  for select to authenticated using (public.is_group_member(group_id));

drop policy if exists "members_insert" on public.group_members;
create policy "members_insert" on public.group_members
  for insert to authenticated
  with check (
    public.is_group_member(group_id)
    or exists (select 1 from public.groups g where g.id = group_id and g.created_by = auth.uid())
  );

drop policy if exists "members_delete" on public.group_members;
create policy "members_delete" on public.group_members
  for delete to authenticated
  using (
    profile_id = auth.uid()
    or exists (select 1 from public.groups g where g.id = group_id and g.created_by = auth.uid())
  );

-- expenses: only group members can read/write.
drop policy if exists "expenses_select" on public.expenses;
create policy "expenses_select" on public.expenses
  for select to authenticated using (public.is_group_member(group_id));

drop policy if exists "expenses_insert" on public.expenses;
create policy "expenses_insert" on public.expenses
  for insert to authenticated
  with check (public.is_group_member(group_id) and created_by = auth.uid());

drop policy if exists "expenses_delete" on public.expenses;
create policy "expenses_delete" on public.expenses
  for delete to authenticated
  using (public.is_group_member(group_id));

-- expense_splits: visible/editable when you can see the parent expense.
drop policy if exists "splits_select" on public.expense_splits;
create policy "splits_select" on public.expense_splits
  for select to authenticated
  using (exists (
    select 1 from public.expenses e
    where e.id = expense_id and public.is_group_member(e.group_id)
  ));

drop policy if exists "splits_insert" on public.expense_splits;
create policy "splits_insert" on public.expense_splits
  for insert to authenticated
  with check (exists (
    select 1 from public.expenses e
    where e.id = expense_id and public.is_group_member(e.group_id)
  ));

-- settlements: only group members.
drop policy if exists "settlements_select" on public.settlements;
create policy "settlements_select" on public.settlements
  for select to authenticated using (public.is_group_member(group_id));

drop policy if exists "settlements_insert" on public.settlements;
create policy "settlements_insert" on public.settlements
  for insert to authenticated
  with check (public.is_group_member(group_id));
