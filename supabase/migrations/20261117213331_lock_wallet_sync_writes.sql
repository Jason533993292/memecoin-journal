-- All wallet-sync writes pass through Firebase-authenticated server routes.
-- Browsers may read their own RLS-filtered rows but cannot forge verification,
-- sync cursors, event provenance, or review status directly.
revoke all on table public.wallet_links, public.wallet_events from authenticated;
grant select on table public.wallet_links, public.wallet_events to authenticated;
