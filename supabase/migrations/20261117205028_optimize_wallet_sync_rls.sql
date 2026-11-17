drop policy if exists "Users manage only their own wallet links" on public.wallet_links;
create policy "Users manage only their own wallet links"
  on public.wallet_links for all to authenticated
  using (((select auth.jwt()) ->> 'sub') = user_id)
  with check (((select auth.jwt()) ->> 'sub') = user_id);

drop policy if exists "Users manage only their own wallet events" on public.wallet_events;
create policy "Users manage only their own wallet events"
  on public.wallet_events for all to authenticated
  using (((select auth.jwt()) ->> 'sub') = user_id)
  with check (((select auth.jwt()) ->> 'sub') = user_id);
