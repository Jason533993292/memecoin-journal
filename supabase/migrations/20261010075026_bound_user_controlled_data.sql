-- Bound every client-writable payload so a valid account cannot use the
-- project's public Data API to store arbitrarily large or malformed values.
create or replace function public.is_bounded_text_array(
  input_value jsonb,
  max_items integer,
  max_item_length integer
)
returns boolean
language sql
immutable
strict
security invoker
set search_path = ''
as $$
  select
    jsonb_typeof(input_value) = 'array'
    and jsonb_array_length(input_value) <= max_items
    and not exists (
      select 1
      from jsonb_array_elements(input_value) as entry(item)
      where jsonb_typeof(entry.item) <> 'string'
        or char_length(entry.item #>> '{}'::text[]) > max_item_length
    );
$$;

revoke all on function public.is_bounded_text_array(jsonb, integer, integer) from public, anon;
grant execute on function public.is_bounded_text_array(jsonb, integer, integer) to authenticated;

alter table public.trades
  add constraint trades_valid_contract_address check (char_length(ca) <= 64),
  add constraint trades_valid_dex check (dex is null or char_length(dex) <= 80),
  add constraint trades_valid_execution_type check (
    execution_type is null
    or execution_type in ('discretionary', 'momentum', 'sniper', 'copy', 'other')
  ),
  add constraint trades_valid_quality_score check (
    trade_quality_score is null or trade_quality_score between 0 and 10
  ),
  add constraint trades_valid_market_values check (
    (mcap is null or mcap between 0 and 1000000000000000)
    and (liquidity is null or liquidity between 0 and 1000000000000000)
    and (entry_liquidity_usd is null or entry_liquidity_usd between 0 and 1000000000000000)
    and (exit_liquidity_usd is null or exit_liquidity_usd between 0 and 1000000000000000)
    and (entry_market_cap_usd is null or entry_market_cap_usd between 0 and 1000000000000000)
    and (exit_market_cap_usd is null or exit_market_cap_usd between 0 and 1000000000000000)
    and (price is null or price between 0 and 1000000000000000)
    and (stop_price is null or stop_price between 0 and 1000000000000000)
    and (slippage_pct is null or slippage_pct between 0 and 10000)
  ),
  add constraint trades_valid_amounts check (
    bought_sol between 0 and 100000000
    and (bought_usd is null or bought_usd between 0 and 100000000000)
    and (sold_sol is null or sold_sol between 0 and 100000000)
    and (sold_usd is null or sold_usd between 0 and 100000000000)
    and pnl_sol between -100000000 and 100000000
    and pnl_usd between -100000000000 and 100000000000
    and (initial_risk_sol is null or initial_risk_sol between 0 and 100000000)
    and (fees_sol is null or fees_sol between 0 and 100000000)
    and (sol_usd_rate is null or sol_usd_rate between 0 and 1000000000)
  ),
  add constraint trades_valid_duration_timezone check (
    (duration_minutes is null or duration_minutes between 0 and 5256000)
    and (entry_timezone_offset is null or entry_timezone_offset between -840 and 840)
  ),
  add constraint trades_valid_rate_source check (
    sol_usd_rate_source is null
    or sol_usd_rate_source in ('user', 'live-at-entry', 'imported', 'unknown')
  ),
  add constraint trades_valid_mistakes check (
    public.is_bounded_text_array(mistakes, 20, 80)
  ),
  add constraint trades_valid_good_tags check (
    public.is_bounded_text_array(good_tags, 20, 80)
  ),
  add constraint trades_valid_extra check (
    jsonb_typeof(extra) = 'object' and octet_length(extra::text) <= 16384
  );

alter table public.wallets
  add constraint wallets_valid_user_id check (char_length(user_id) between 1 and 128),
  add constraint wallets_valid_extra check (
    jsonb_typeof(extra) = 'object' and octet_length(extra::text) <= 16384
  );

alter table public.wallet_transactions
  add constraint wallet_transactions_valid_user_id check (char_length(user_id) between 1 and 128),
  add constraint wallet_transactions_valid_amounts check (
    amount_sol > 0
    and amount_sol <= 100000000
    and amount_sol = trunc(amount_sol, 9)
    and (amount_usd is null or amount_usd between 0 and 100000000000)
  ),
  add constraint wallet_transactions_valid_extra check (
    jsonb_typeof(extra) = 'object' and octet_length(extra::text) <= 16384
  );

alter table public.user_settings
  add constraint user_settings_valid_user_id check (char_length(user_id) between 1 and 128),
  add constraint user_settings_valid_data check (
    jsonb_typeof(data) = 'object' and octet_length(data::text) <= 65536
  );
