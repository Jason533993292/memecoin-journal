-- Keep the wallet balance update and its audit-log insert atomic during the
-- Firebase-authenticated Supabase rollout. This is SECURITY INVOKER, so RLS
-- still applies to every statement.
create or replace function public.apply_wallet_transaction(
  p_user_id text,
  p_wallet_id text,
  p_transaction_id text,
  p_wallet_name text,
  p_delta_sol numeric,
  p_amount_usd numeric,
  p_notes text,
  p_date timestamptz,
  p_created_at timestamptz
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_current_balance numeric;
  v_user_id text := auth.jwt() ->> 'sub';
begin
  if not (select public.is_trusted_journal_jwt()) then
    raise exception 'Untrusted authentication token';
  end if;

  if v_user_id is null or v_user_id <> p_user_id then
    raise exception 'Cannot modify another user''s wallet';
  end if;

  if p_delta_sol = 0 or p_transaction_id !~ '^[A-Za-z0-9_-]{1,100}$' then
    raise exception 'Invalid wallet transaction';
  end if;

  select balance_sol into v_current_balance
  from public.wallets
  where user_id = p_user_id and id = p_wallet_id
  for update;

  if not found then
    raise exception 'Wallet no longer exists';
  end if;

  update public.wallets
  set balance_sol = greatest(0, round((v_current_balance + p_delta_sol)::numeric, 3)),
      updated_at = now()
  where user_id = p_user_id and id = p_wallet_id;

  insert into public.wallet_transactions (
    user_id, id, wallet_id, wallet_name, type, amount_sol, amount_usd, notes, date, created_at
  ) values (
    p_user_id,
    p_transaction_id,
    p_wallet_id,
    p_wallet_name,
    case when p_delta_sol >= 0 then 'deposit' else 'paycheck' end,
    abs(p_delta_sol),
    p_amount_usd,
    p_notes,
    p_date,
    p_created_at
  );
end;
$$;

revoke all on function public.apply_wallet_transaction(text, text, text, text, numeric, numeric, text, timestamptz, timestamptz) from public, anon;
grant execute on function public.apply_wallet_transaction(text, text, text, text, numeric, numeric, text, timestamptz, timestamptz) to authenticated;
