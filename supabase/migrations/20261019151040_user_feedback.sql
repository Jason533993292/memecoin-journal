-- Authenticated beta feedback is accepted only by the server route. The
-- browser never receives direct access to this table or the service-role key.
create table if not exists public.user_feedback (
  id bigint generated always as identity primary key,
  user_id text not null,
  category text not null check (category in ('bug', 'suggestion', 'other')),
  message text not null,
  contact_email text,
  page text not null default '',
  device text not null default '',
  browser text not null default '',
  viewport text not null default '',
  theme text not null default '',
  status text not null default 'new' check (status in ('new', 'reviewed', 'resolved')),
  created_at timestamptz not null default now(),
  check (char_length(user_id) between 1 and 128),
  check (char_length(message) between 15 and 2000),
  check (contact_email is null or char_length(contact_email) <= 320),
  check (char_length(page) <= 500),
  check (char_length(device) <= 120),
  check (char_length(browser) <= 120),
  check (char_length(viewport) <= 40),
  check (char_length(theme) <= 40)
);

create index if not exists user_feedback_created_at_idx
  on public.user_feedback (created_at desc);

alter table public.user_feedback enable row level security;

revoke all on table public.user_feedback from public, anon, authenticated;
revoke all on sequence public.user_feedback_id_seq from public, anon, authenticated;

grant select, insert, update, delete on table public.user_feedback to service_role;
grant usage, select on sequence public.user_feedback_id_seq to service_role;
