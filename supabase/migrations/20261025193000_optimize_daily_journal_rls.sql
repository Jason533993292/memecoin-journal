-- Evaluate the caller JWT once per statement instead of once per row.
drop policy if exists "Users read only their own daily journal entries" on public.daily_journal_entries;
drop policy if exists "Users create only their own daily journal entries" on public.daily_journal_entries;
drop policy if exists "Users update only their own daily journal entries" on public.daily_journal_entries;
drop policy if exists "Users delete only their own daily journal entries" on public.daily_journal_entries;

create policy "Users read only their own daily journal entries"
  on public.daily_journal_entries for select to authenticated
  using (((select auth.jwt()) ->> 'sub') = user_id);

create policy "Users create only their own daily journal entries"
  on public.daily_journal_entries for insert to authenticated
  with check (((select auth.jwt()) ->> 'sub') = user_id);

create policy "Users update only their own daily journal entries"
  on public.daily_journal_entries for update to authenticated
  using (((select auth.jwt()) ->> 'sub') = user_id)
  with check (((select auth.jwt()) ->> 'sub') = user_id);

create policy "Users delete only their own daily journal entries"
  on public.daily_journal_entries for delete to authenticated
  using (((select auth.jwt()) ->> 'sub') = user_id);
