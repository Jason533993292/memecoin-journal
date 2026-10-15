-- RLS decides which rows a signed-in user may access, while table grants
-- decide which operations are available at all. Remove Supabase's broad
-- default privileges (including TRUNCATE, TRIGGER, and REFERENCES) and grant
-- only the CRUD operations used by the journal client.

revoke all on table
  public.trades,
  public.wallets,
  public.wallet_transactions,
  public.user_settings,
  public.coin_research,
  public.revoked_journal_users
from anon;

revoke all on table
  public.trades,
  public.wallets,
  public.wallet_transactions,
  public.user_settings,
  public.coin_research,
  public.revoked_journal_users
from authenticated;

grant select, insert, update, delete on table
  public.trades,
  public.wallets,
  public.wallet_transactions,
  public.user_settings,
  public.coin_research
to authenticated;

-- The trust predicate needs to check only the caller's own revocation marker.
grant select on table public.revoked_journal_users to authenticated;
