-- PostgreSQL grants EXECUTE to PUBLIC by default for newly created functions.
-- Make the internal JWT predicate callable only from the authenticated role.
revoke execute on function public.is_trusted_journal_jwt() from public, anon;
grant execute on function public.is_trusted_journal_jwt() to authenticated;
