-- ============================================================================
-- Per-group currency. Existing groups default to INR.
-- Run this in the Supabase SQL Editor after 0002.
-- ============================================================================
alter table public.groups
  add column if not exists currency text not null default 'INR';
