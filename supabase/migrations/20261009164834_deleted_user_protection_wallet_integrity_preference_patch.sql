-- Revoke the database side of an account as soon as deletion begins. Firebase
-- ID tokens remain cryptographically valid until expiry, so deleting the Auth
-- user alone does not prevent a cached token from recreating Supabase rows.
create table if not exists public.revoked_journal_users (
  user_id text primary key,
  revoked_at timestamptz not null default now(),
  check (char_length(user_id) between 1 and 128)
);

alter table public.revoked_journal_users enable row level security;
revoke all on table public.revoked_journal_users from public, anon, authenticated;
grant select, insert, update, delete on table public.revoked_journal_users to service_role;

-- This zero-argument SECURITY DEFINER check is required because the revocation
-- table is intentionally inaccessible to client roles. It reveals only the
-- current token's boolean status and accepts no user-controlled identifier.
create or replace function public.is_trusted_journal_jwt()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (auth.jwt() ->> 'iss' = 'https://securetoken.google.com/memecoin-journal')
    and (auth.jwt() ->> 'aud' = 'memecoin-journal')
    and (auth.jwt() ->> 'role' = 'authenticated')
    and not exists (
      select 1
      from public.revoked_journal_users as revoked
      where revoked.user_id = (auth.jwt() ->> 'sub')
    );
$$;

revoke all on function public.is_trusted_journal_jwt() from public, anon;
grant execute on function public.is_trusted_journal_jwt() to authenticated;

-- Merge independent preference keys atomically in PostgreSQL. A client-side
-- read/merge/upsert can otherwise lose a concurrent rules or goals update.
create or replace function public.patch_user_preferences(
  p_user_id text,
  p_patch jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.is_trusted_journal_jwt() then
    raise exception 'Untrusted authentication token';
  end if;

  if p_user_id is null or p_user_id <> (auth.jwt() ->> 'sub') then
    raise exception 'Cannot modify another user''s settings';
  end if;

  if p_patch is null
    or jsonb_typeof(p_patch) <> 'object'
    or p_patch = '{}'::jsonb
    or (p_patch - array['rules', 'goals']) <> '{}'::jsonb
    or (p_patch ? 'rules' and jsonb_typeof(p_patch -> 'rules') <> 'object')
    or (p_patch ? 'goals' and jsonb_typeof(p_patch -> 'goals') <> 'object') then
    raise exception 'Invalid preference patch';
  end if;

  insert into public.user_settings as settings (user_id, setting_key, data, updated_at)
  values (p_user_id, 'preferences', p_patch, now())
  on conflict (user_id, setting_key) do update
    set data = settings.data || excluded.data,
        updated_at = now();
end;
$$;

revoke all on function public.patch_user_preferences(text, jsonb) from public, anon;
grant execute on function public.patch_user_preferences(text, jsonb) to authenticated;

-- Wallet balances are bookkeeping values. Preserve all SOL precision and
-- reject overdrafts rather than clipping the balance while logging the larger
-- withdrawal. NOT VALID avoids blocking rollout if old rows need inspection;
-- PostgreSQL still enforces the constraint for new or updated rows.
alter table public.wallets
  add constraint wallets_valid_balance
  check (balance_sol >= 0 and balance_sol <= 100000000 and balance_sol = trunc(balance_sol, 9))
  not valid;

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
  if not public.is_trusted_journal_jwt() then
    raise exception 'Untrusted authentication token';
  end if;

  if v_user_id is null or v_user_id <> p_user_id then
    raise exception 'Cannot modify another user''s wallet';
  end if;

  if p_delta_sol is null
    or p_delta_sol = 0
    or abs(p_delta_sol) > 100000000
    or p_delta_sol <> trunc(p_delta_sol, 9)
    or p_transaction_id !~ '^[A-Za-z0-9_-]{1,100}$'
    or p_wallet_name is null
    or char_length(p_wallet_name) not between 1 and 80
    or (p_amount_usd is not null and (p_amount_usd < 0 or p_amount_usd > 100000000000))
    or (p_notes is not null and char_length(p_notes) > 500)
    or p_date is null
    or p_created_at is null then
    raise exception 'Invalid wallet transaction';
  end if;

  select balance_sol into v_current_balance
  from public.wallets
  where user_id = p_user_id and id = p_wallet_id
  for update;

  if not found then
    raise exception 'Wallet no longer exists';
  end if;

  if p_delta_sol < 0 and abs(p_delta_sol) > v_current_balance then
    raise exception 'Withdrawal exceeds the wallet balance';
  end if;

  if v_current_balance + p_delta_sol > 100000000 then
    raise exception 'Wallet balance exceeds the supported maximum';
  end if;

  update public.wallets
  set balance_sol = v_current_balance + p_delta_sol,
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

-- Evaluate the Firebase UID claim once per statement rather than once per row.
drop policy if exists "Users manage only their own trades" on public.trades;
create policy "Users manage only their own trades"
  on public.trades for all to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check ((select auth.jwt() ->> 'sub') = user_id);

drop policy if exists "Users manage only their own wallets" on public.wallets;
create policy "Users manage only their own wallets"
  on public.wallets for all to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check ((select auth.jwt() ->> 'sub') = user_id);

drop policy if exists "Users manage only their own wallet transactions" on public.wallet_transactions;
create policy "Users manage only their own wallet transactions"
  on public.wallet_transactions for all to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check ((select auth.jwt() ->> 'sub') = user_id);

drop policy if exists "Users manage only their own settings" on public.user_settings;
create policy "Users manage only their own settings"
  on public.user_settings for all to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check ((select auth.jwt() ->> 'sub') = user_id);
