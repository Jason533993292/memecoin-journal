-- A sync lease expires if its worker exits before releasing it.
alter table public.wallet_links add column sync_lease uuid, add column sync_lease_until timestamptz;

create function public.save_wallet_position(p_owner text, p_ids uuid[], p_row jsonb)
returns text language plpgsql security invoker set search_path = '' as $$
declare
  first_id text := p_ids[1]::text;
  event_count int;
  wallet_count int;
  prior jsonb;
begin
  if coalesce(cardinality(p_ids),0) not between 1 and 500 or
     exists (select 1 from public.revoked_journal_users where user_id=p_owner) then
    raise exception 'Position cannot be saved';
  end if;
  perform id from public.wallet_events where user_id=p_owner and id=any(p_ids) order by id for update;
  select count(*),count(distinct wallet_link_id) into event_count,wallet_count
    from public.wallet_events where user_id=p_owner and id=any(p_ids) and mint=p_row->>'ca';
  if event_count <> cardinality(p_ids) or wallet_count <> 1 then raise exception 'Invalid position'; end if;
  select extra->'walletEventIds' into prior from public.trades where user_id=p_owner and id=first_id;
  if found then
    if prior is distinct from to_jsonb(p_ids) then raise exception 'Trade ID conflict'; end if;
  else
    if exists (select 1 from public.wallet_events where user_id=p_owner and id=any(p_ids) and status='imported') then
      raise exception 'Position already imported';
    end if;
    p_row := p_row || jsonb_build_object('user_id',p_owner,'id',first_id,'extra',
      coalesce(p_row->'extra','{}'::jsonb) || jsonb_build_object('walletEventIds',to_jsonb(p_ids)));
    insert into public.trades select * from jsonb_populate_record(null::public.trades,p_row);
  end if;
  update public.wallet_events set status='imported',updated_at=now() where user_id=p_owner and id=any(p_ids);
  return first_id;
end $$;
revoke all on function public.save_wallet_position(text,uuid[],jsonb) from public,anon,authenticated;
grant execute on function public.save_wallet_position(text,uuid[],jsonb) to service_role;
