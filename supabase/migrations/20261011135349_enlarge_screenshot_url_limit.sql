-- Older Firestore records can contain a screenshot compressed under the
-- document-size limit but larger than the newer 500k character guard. Keep
-- the database below Firestore's former payload ceiling while allowing those
-- existing records to migrate without dropping their evidence image.
alter table public.trades
  drop constraint if exists trades_screenshot_url_check;

alter table public.trades
  add constraint trades_screenshot_url_check
  check (screenshot_url is null or char_length(screenshot_url) <= 750000);
