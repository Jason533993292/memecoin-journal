-- Evaluate the JWT claim once per statement instead of once per row.
drop policy if exists "Users manage only their own coin research" on public.coin_research;
create policy "Users manage only their own coin research"
  on public.coin_research for all to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check ((select auth.jwt() ->> 'sub') = user_id);
