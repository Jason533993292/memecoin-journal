-- Persistent, read-only Solana wallet synchronization.
-- Wallets never store private keys or seed phrases. Every linked address and
-- detected event remains owner-scoped through Firebase-backed Supabase RLS.

create table public.wallet_links (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  address text not null,
  label text not null default 'Solana wallet',
  last_synced_signature text,
  last_synced_at timestamptz,
  verified_at timestamptz,
  verification_nonce text,
  verification_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, address),
  check (char_length(user_id) between 1 and 128),
  check (address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  check (char_length(label) between 1 and 80),
  check (last_synced_signature is null or char_length(last_synced_signature) between 64 and 128),
  check (verification_nonce is null or char_length(verification_nonce) between 20 and 200)
);

create table public.wallet_events (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  wallet_link_id uuid not null references public.wallet_links(id) on delete cascade,
  signature text not null,
  event_index integer not null default 0,
  block_time timestamptz not null,
  mint text not null,
  direction text not null check (direction in ('buy', 'sell', 'transfer', 'unknown')),
  sol_change numeric not null default 0,
  token_change numeric not null default 0,
  fee_sol numeric not null default 0,
  status text not null default 'needs_review' check (status in ('needs_review', 'imported', 'ignored')),
  source text not null default 'rpc' check (source in ('rpc', 'webhook')),
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (wallet_link_id, signature, event_index),
  check (char_length(user_id) between 1 and 128),
  check (char_length(signature) between 64 and 128),
  check (mint = '' or mint ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  check (fee_sol >= 0),
  check (jsonb_typeof(raw) = 'object'),
  check (pg_column_size(raw) <= 16384)
);

create index wallet_links_user_updated_idx on public.wallet_links (user_id, updated_at desc);
create index wallet_events_review_idx on public.wallet_events (user_id, status, block_time desc);
create index wallet_events_wallet_signature_idx on public.wallet_events (wallet_link_id, signature);

alter table public.wallet_links enable row level security;
alter table public.wallet_events enable row level security;

revoke all on table public.wallet_links, public.wallet_events from public, anon, authenticated;
grant select on table public.wallet_links, public.wallet_events to authenticated;

create policy "Users manage only their own wallet links"
  on public.wallet_links for all to authenticated
  using ((auth.jwt() ->> 'sub') = user_id)
  with check ((auth.jwt() ->> 'sub') = user_id);

create policy "Only memecoin-journal Firebase tokens use wallet links"
  on public.wallet_links as restrictive to authenticated
  using ((select public.is_trusted_journal_jwt()) is true)
  with check ((select public.is_trusted_journal_jwt()) is true);

create policy "Users manage only their own wallet events"
  on public.wallet_events for all to authenticated
  using ((auth.jwt() ->> 'sub') = user_id)
  with check ((auth.jwt() ->> 'sub') = user_id);

create policy "Only memecoin-journal Firebase tokens use wallet events"
  on public.wallet_events as restrictive to authenticated
  using ((select public.is_trusted_journal_jwt()) is true)
  with check ((select public.is_trusted_journal_jwt()) is true);

comment on table public.wallet_links is 'Read-only public Solana addresses linked by a journal user.';
comment on table public.wallet_events is 'Idempotent on-chain events awaiting review before journal import.';
