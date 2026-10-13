-- Additive, per-account research workspace. Existing journal data is untouched.
create table if not exists public.coin_research (
  user_id text not null,
  ca text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, ca),
  check (char_length(user_id) between 1 and 128),
  check (char_length(ca) between 1 and 128),
  check (jsonb_typeof(data) = 'object'),
  check (octet_length(data::text) <= 90000)
);

create index if not exists coin_research_user_updated_idx
  on public.coin_research (user_id, updated_at desc);

alter table public.coin_research enable row level security;
grant select, insert, update, delete on public.coin_research to authenticated;

create policy "Users manage only their own coin research"
  on public.coin_research for all to authenticated
  using ((auth.jwt() ->> 'sub') = user_id)
  with check ((auth.jwt() ->> 'sub') = user_id);

create policy "Only memecoin-journal Firebase tokens use coin research"
  on public.coin_research as restrictive to authenticated
  using ((select public.is_trusted_journal_jwt()) is true)
  with check ((select public.is_trusted_journal_jwt()) is true);
