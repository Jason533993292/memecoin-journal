create table public.wallet_sync_hours (
  hour timestamptz primary key,
  successful bigint not null default 0, failed bigint not null default 0, unsupported bigint not null default 0
);
alter table public.wallet_sync_hours enable row level security;
revoke all on public.wallet_sync_hours from public, anon, authenticated;
grant select,insert,update,delete on public.wallet_sync_hours to service_role;
create function public.record_wallet_sync(p_failed boolean,p_unsupported integer)
returns void language sql security invoker set search_path='' as $$
  insert into public.wallet_sync_hours as h(hour,successful,failed,unsupported)
    values(date_trunc('hour',now()), (not p_failed)::int,p_failed::int,greatest(0,p_unsupported))
    on conflict(hour) do update set successful=h.successful+excluded.successful,
      failed=h.failed+excluded.failed,unsupported=h.unsupported+excluded.unsupported;
  delete from public.wallet_sync_hours where hour < now()-interval '14 days';
$$;
revoke all on function public.record_wallet_sync(boolean,integer) from public,anon,authenticated;
grant execute on function public.record_wallet_sync(boolean,integer) to service_role;
