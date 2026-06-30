-- ============================================================================
-- Group type (personal 1-on-1 vs group) + recurring expenses
-- Run in Supabase SQL Editor after 0003.
-- ============================================================================

-- 'personal' = 2-person expense tracking between friends
-- 'group'    = the original multi-person group
alter table public.groups
  add column if not exists type text not null default 'group'
    check (type in ('group', 'personal'));

-- ---------------------------------------------------------------------------
-- recurring_expenses: a template that auto-generates expenses on a schedule.
-- next_due_at advances each time the frontend fires the expense.
-- split_data stores the split config as JSON so it can be replayed.
-- ---------------------------------------------------------------------------
create table if not exists public.recurring_expenses (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.groups (id) on delete cascade,
  description  text not null,
  amount       numeric(12, 2) not null check (amount > 0),
  category     text not null default 'general',
  paid_by      uuid not null references public.profiles (id),
  split_mode   text not null default 'equal'
                 check (split_mode in ('equal', 'full', 'percent', 'custom')),
  split_data   jsonb not null default '{}',
  -- split_data shape:
  --   equal:   { "involved": ["<id>", ...] }
  --   full:    { "fullPayer": "<id>" }
  --   percent: { "percentMap": { "<id>": 50, ... } }
  --   custom:  { "customMap": { "<id>": 250.00, ... } }
  frequency    text not null check (frequency in ('daily', 'weekly', 'monthly', 'yearly')),
  next_due_at  date not null,
  created_by   uuid not null references public.profiles (id),
  created_at   timestamptz not null default now(),
  active       boolean not null default true
);

create index if not exists idx_recurring_group on public.recurring_expenses (group_id);
create index if not exists idx_recurring_due   on public.recurring_expenses (next_due_at)
  where active = true;

alter table public.recurring_expenses enable row level security;

drop policy if exists "recurring_select" on public.recurring_expenses;
create policy "recurring_select" on public.recurring_expenses
  for select to authenticated using (public.is_group_member(group_id));

drop policy if exists "recurring_insert" on public.recurring_expenses;
create policy "recurring_insert" on public.recurring_expenses
  for insert to authenticated
  with check (public.is_group_member(group_id) and created_by = auth.uid());

drop policy if exists "recurring_update" on public.recurring_expenses;
create policy "recurring_update" on public.recurring_expenses
  for update to authenticated using (public.is_group_member(group_id));

drop policy if exists "recurring_delete" on public.recurring_expenses;
create policy "recurring_delete" on public.recurring_expenses
  for delete to authenticated
  using (
    created_by = auth.uid()
    or exists (select 1 from public.groups g where g.id = group_id and g.created_by = auth.uid())
  );
