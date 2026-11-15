-- Preserve the wallet ledger: callers may set an opening balance when a wallet
-- is created, but later balance changes must go through apply_wallet_transaction.

create or replace function public.upsert_wallet(
  p_user_id text,
  p_wallet_id text,
  p_name text,
  p_opening_balance_sol numeric,
  p_address text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id text := auth.jwt() ->> 'sub';
begin
  if not (select public.is_trusted_journal_jwt()) then
    raise exception 'Untrusted authentication token';
  end if;

  if v_user_id is null or v_user_id <> p_user_id then
    raise exception 'Cannot modify another user''s wallet';
  end if;

  if p_wallet_id !~ '^[A-Za-z0-9_-]{1,100}$'
    or char_length(p_name) not between 1 and 80
    or char_length(p_address) not between 1 and 128
    or p_opening_balance_sol < 0
    or p_opening_balance_sol > 100000000 then
    raise exception 'Invalid wallet';
  end if;

  insert into public.wallets (
    user_id, id, name, balance_sol, address, updated_at
  ) values (
    p_user_id,
    p_wallet_id,
    p_name,
    round(p_opening_balance_sol::numeric, 9),
    p_address,
    now()
  )
  on conflict (user_id, id) do update
  set name = excluded.name,
      address = excluded.address,
      updated_at = now();
end;
$$;

revoke all on function public.upsert_wallet(text, text, text, numeric, text) from public, anon;
grant execute on function public.upsert_wallet(text, text, text, numeric, text) to authenticated;

revoke update on table public.wallets from authenticated;
grant update (name, address, updated_at) on table public.wallets to authenticated;
