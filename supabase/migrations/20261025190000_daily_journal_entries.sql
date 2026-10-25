-- Private daily writing journal. Firebase Auth supplies the trusted user ID;
-- RLS and minimal grants keep every entry isolated to its owner.
create table if not exists public.daily_journal_entries (
  user_id text not null,
  id text not null,
  title text not null default 'Untitled entry',
  content_html text not null default '',
  plain_text text not null default '',
  entry_type text not null check (entry_type in ('free', 'pre_trade', 'post_trade', 'end_of_day')),
  entry_date date not null,
  emotions text[] not null default '{}',
  emotion_intensity smallint,
  energy_level smallint,
  confidence_level smallint,
  tags text[] not null default '{}',
  linked_trade_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  check (char_length(user_id) between 1 and 128),
  check (char_length(id) between 1 and 150),
  check (char_length(title) between 1 and 160),
  check (char_length(content_html) <= 100000),
  check (char_length(plain_text) <= 40000),
  check (cardinality(emotions) <= 12),
  check (cardinality(tags) <= 20),
  check (cardinality(linked_trade_ids) <= 50),
  check (emotion_intensity is null or emotion_intensity between 1 and 5),
  check (energy_level is null or energy_level between 1 and 5),
  check (confidence_level is null or confidence_level between 1 and 5)
);

create index if not exists daily_journal_user_date_idx
  on public.daily_journal_entries (user_id, entry_date desc, updated_at desc);

alter table public.daily_journal_entries enable row level security;
revoke all on table public.daily_journal_entries from public, anon, authenticated;
grant select, insert, update, delete on table public.daily_journal_entries to authenticated;
grant select, insert, update, delete on table public.daily_journal_entries to service_role;

create policy "Users read only their own daily journal entries"
  on public.daily_journal_entries for select to authenticated
  using (((select auth.jwt()) ->> 'sub') = user_id);

create policy "Users create only their own daily journal entries"
  on public.daily_journal_entries for insert to authenticated
  with check (((select auth.jwt()) ->> 'sub') = user_id);

create policy "Users update only their own daily journal entries"
  on public.daily_journal_entries for update to authenticated
  using (((select auth.jwt()) ->> 'sub') = user_id)
  with check (((select auth.jwt()) ->> 'sub') = user_id);

create policy "Users delete only their own daily journal entries"
  on public.daily_journal_entries for delete to authenticated
  using (((select auth.jwt()) ->> 'sub') = user_id);

create policy "Only memecoin-journal Firebase tokens use daily journal entries"
  on public.daily_journal_entries as restrictive to authenticated
  using ((select public.is_trusted_journal_jwt()) is true)
  with check ((select public.is_trusted_journal_jwt()) is true);
