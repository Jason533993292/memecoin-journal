-- Keep the revocation registry inaccessible for writes and not readable across
-- accounts, while allowing the invoker-security JWT check to read its own row.
revoke all on table public.revoked_journal_users from public, anon, authenticated;
grant select on table public.revoked_journal_users to authenticated;
grant select, insert, update, delete on table public.revoked_journal_users to service_role;

drop policy if exists "Users can read their own revocation marker" on public.revoked_journal_users;
create policy "Users can read their own revocation marker"
  on public.revoked_journal_users for select to authenticated
  using (((select auth.jwt()) ->> 'sub') = user_id);

-- This function only reads the current caller's marker. SECURITY INVOKER avoids
-- exposing a callable SECURITY DEFINER RPC; RLS above limits its table access.
create or replace function public.is_trusted_journal_jwt()
returns boolean
language sql
stable
security invoker
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

-- Match Supabase's init-plan optimization form for per-statement JWT values.
drop policy if exists "Users manage only their own trades" on public.trades;
create policy "Users manage only their own trades"
  on public.trades for all to authenticated
  using (((select auth.jwt()) ->> 'sub') = user_id)
  with check (((select auth.jwt()) ->> 'sub') = user_id);

drop policy if exists "Users manage only their own wallets" on public.wallets;
create policy "Users manage only their own wallets"
  on public.wallets for all to authenticated
  using (((select auth.jwt()) ->> 'sub') = user_id)
  with check (((select auth.jwt()) ->> 'sub') = user_id);

drop policy if exists "Users manage only their own wallet transactions" on public.wallet_transactions;
create policy "Users manage only their own wallet transactions"
  on public.wallet_transactions for all to authenticated
  using (((select auth.jwt()) ->> 'sub') = user_id)
  with check (((select auth.jwt()) ->> 'sub') = user_id);

drop policy if exists "Users manage only their own settings" on public.user_settings;
create policy "Users manage only their own settings"
  on public.user_settings for all to authenticated
  using (((select auth.jwt()) ->> 'sub') = user_id)
  with check (((select auth.jwt()) ->> 'sub') = user_id);
