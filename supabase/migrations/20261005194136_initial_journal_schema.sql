-- Additive Supabase schema for the existing Firebase-authenticated journal.
-- Firebase UID and Firestore document IDs are deliberately preserved as text.
-- No data is copied or removed by this migration.

create table if not exists public.trades (
  user_id text not null,
  id text not null,
  ca text not null default '',
  name text not null,
  symbol text not null,
  wallet text not null,
  result text not null check (result in ('Win', 'Loss', 'BE')),
  setup_type text not null,
  mcap numeric,
  liquidity numeric,
  entry_liquidity_usd numeric,
  exit_liquidity_usd numeric,
  entry_market_cap_usd numeric,
  exit_market_cap_usd numeric,
  slippage_pct numeric,
  dex text,
  execution_type text,
  would_take_again boolean,
  trade_quality_score numeric,
  price numeric,
  bought_sol numeric not null default 0,
  bought_usd numeric,
  sold_sol numeric,
  sold_usd numeric,
  pnl_sol numeric not null default 0,
  pnl_usd numeric not null default 0,
  mistakes jsonb not null default '[]'::jsonb,
  good_tags jsonb not null default '[]'::jsonb,
  is_paper boolean,
  notes text,
  screenshot_url text,
  duration_minutes numeric,
  entry_time timestamptz,
  exit_time timestamptz,
  initial_risk_sol numeric,
  stop_price numeric,
  fees_sol numeric,
  entry_timezone_offset numeric,
  traded_at timestamptz,
  sol_usd_rate numeric,
  sol_usd_rate_source text,
  trade_mode text check (trade_mode is null or trade_mode in ('real', 'paper')),
  date timestamptz not null,
  created_at timestamptz,
  extra jsonb not null default '{}'::jsonb,
  primary key (user_id, id),
  check (char_length(user_id) between 1 and 128),
  check (char_length(id) between 1 and 150),
  check (char_length(name) between 1 and 120),
  check (char_length(symbol) between 1 and 40),
  check (char_length(wallet) between 1 and 80),
  check (char_length(setup_type) between 1 and 120),
  check (notes is null or char_length(notes) <= 4000),
  check (screenshot_url is null or char_length(screenshot_url) <= 500000),
  check (jsonb_typeof(mistakes) = 'array' and jsonb_array_length(mistakes) <= 20),
  check (jsonb_typeof(good_tags) = 'array' and jsonb_array_length(good_tags) <= 20)
);

create table if not exists public.wallets (
  user_id text not null,
  id text not null,
  name text not null,
  balance_sol numeric not null default 0,
  address text not null,
  updated_at timestamptz not null,
  extra jsonb not null default '{}'::jsonb,
  primary key (user_id, id),
  check (char_length(id) between 1 and 100),
  check (char_length(name) between 1 and 80),
  check (char_length(address) between 1 and 128)
);

create table if not exists public.wallet_transactions (
  user_id text not null,
  id text not null,
  wallet_id text not null,
  wallet_name text not null,
  type text not null check (type in ('deposit', 'paycheck')),
  amount_sol numeric not null check (amount_sol > 0),
  amount_usd numeric,
  notes text,
  date timestamptz not null,
  created_at timestamptz not null,
  extra jsonb not null default '{}'::jsonb,
  primary key (user_id, id),
  check (char_length(id) between 1 and 100),
  check (char_length(wallet_id) between 1 and 100),
  check (char_length(wallet_name) between 1 and 80),
  check (notes is null or char_length(notes) <= 500)
);

-- Firestore settings/{preferences,walletConfig} become typed keys with a JSON
-- payload so older and newer settings remain round-trippable during rollout.
create table if not exists public.user_settings (
  user_id text not null,
  setting_key text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, setting_key),
  check (setting_key in ('preferences', 'walletConfig'))
);

create index if not exists trades_user_date_idx on public.trades (user_id, date desc);
create index if not exists trades_user_wallet_idx on public.trades (user_id, wallet);
create index if not exists wallet_transactions_user_date_idx on public.wallet_transactions (user_id, date desc);

-- Firebase Auth uses a shared signing-key infrastructure. Keep an explicit
-- restrictive check even though the hosted Supabase integration validates the
-- registered project before Postgres sees the token.
create or replace function public.is_trusted_journal_jwt()
returns boolean
language sql
stable
set search_path = ''
as $$
  select
    (auth.jwt() ->> 'iss' = 'https://securetoken.google.com/memecoin-journal')
    and (auth.jwt() ->> 'aud' = 'memecoin-journal')
    and (auth.jwt() ->> 'role' = 'authenticated');
$$;

revoke all on function public.is_trusted_journal_jwt() from public;
grant execute on function public.is_trusted_journal_jwt() to authenticated;

-- This event-trigger helper already exists in the new project. It is invoked
-- by Postgres internally; users must never be able to call it through RPC.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

alter table public.trades enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.user_settings enable row level security;

-- Explicit grants and row-level policies are both required. The Firebase
-- third-party integration must be enabled and issue role=authenticated JWTs.
grant select, insert, update, delete on public.trades to authenticated;
grant select, insert, update, delete on public.wallets to authenticated;
grant select, insert, update, delete on public.wallet_transactions to authenticated;
grant select, insert, update, delete on public.user_settings to authenticated;

create policy "Users manage only their own trades"
  on public.trades for all to authenticated
  using ((auth.jwt() ->> 'sub') = user_id)
  with check ((auth.jwt() ->> 'sub') = user_id);

create policy "Users manage only their own wallets"
  on public.wallets for all to authenticated
  using ((auth.jwt() ->> 'sub') = user_id)
  with check ((auth.jwt() ->> 'sub') = user_id);

create policy "Users manage only their own wallet transactions"
  on public.wallet_transactions for all to authenticated
  using ((auth.jwt() ->> 'sub') = user_id)
  with check ((auth.jwt() ->> 'sub') = user_id);

create policy "Users manage only their own settings"
  on public.user_settings for all to authenticated
  using ((auth.jwt() ->> 'sub') = user_id)
  with check ((auth.jwt() ->> 'sub') = user_id);

create policy "Only memecoin-journal Firebase tokens use trades"
  on public.trades as restrictive to authenticated
  using ((select public.is_trusted_journal_jwt()) is true)
  with check ((select public.is_trusted_journal_jwt()) is true);

create policy "Only memecoin-journal Firebase tokens use wallets"
  on public.wallets as restrictive to authenticated
  using ((select public.is_trusted_journal_jwt()) is true)
  with check ((select public.is_trusted_journal_jwt()) is true);

create policy "Only memecoin-journal Firebase tokens use wallet transactions"
  on public.wallet_transactions as restrictive to authenticated
  using ((select public.is_trusted_journal_jwt()) is true)
  with check ((select public.is_trusted_journal_jwt()) is true);

create policy "Only memecoin-journal Firebase tokens use settings"
  on public.user_settings as restrictive to authenticated
  using ((select public.is_trusted_journal_jwt()) is true)
  with check ((select public.is_trusted_journal_jwt()) is true);

-- API credentials intentionally are not represented in this schema. AI keys
-- remain on the user's device and must never be included in migration exports.
