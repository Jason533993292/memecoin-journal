create table if not exists public.account_security_events (
  id bigint generated always as identity primary key,
  user_id text not null,
  event_type text not null check (event_type in (
    'password_reset_requested',
    'verification_email_requested',
    'trading_data_deleted',
    'signed_out'
  )),
  request_id text not null default '',
  created_at timestamptz not null default now(),
  check (char_length(user_id) between 1 and 128),
  check (char_length(request_id) <= 80)
);

create index if not exists account_security_events_user_id_created_at_idx
  on public.account_security_events (user_id, created_at desc);

alter table public.account_security_events enable row level security;

revoke all on table public.account_security_events from public, anon, authenticated;
revoke all on sequence public.account_security_events_id_seq from public, anon, authenticated;
grant select, insert, delete on table public.account_security_events to service_role;
grant usage, select on sequence public.account_security_events_id_seq to service_role;

drop policy if exists "No direct browser security history access" on public.account_security_events;
create policy "No direct browser security history access" on public.account_security_events
  for all to anon, authenticated using (false) with check (false);

comment on table public.account_security_events is
  'Private server-written account security history. Never stores IP addresses, tokens, or submitted secrets.';
