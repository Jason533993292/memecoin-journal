-- Match the Firestore contract: wallet history is an audit log. Clients may
-- read and append their own rows, but cannot rewrite or remove existing ones.

revoke update, delete on table public.wallet_transactions from authenticated;

drop policy if exists "Users manage only their own wallet transactions"
  on public.wallet_transactions;

create policy "Users read only their own wallet transactions"
  on public.wallet_transactions for select to authenticated
  using (((select auth.jwt()) ->> 'sub') = user_id);

create policy "Users append only their own wallet transactions"
  on public.wallet_transactions for insert to authenticated
  with check (((select auth.jwt()) ->> 'sub') = user_id);
