-- Additive: inherits the existing per-user RLS policies and grants.
alter table public.daily_journal_entries
  add column if not exists details jsonb not null default '{}'::jsonb;
alter table public.daily_journal_entries
  add constraint daily_journal_details_object check (jsonb_typeof(details) = 'object'),
  add constraint daily_journal_details_size check (octet_length(details::text) <= 2000000);
