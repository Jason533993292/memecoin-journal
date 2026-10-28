alter table public.user_feedback
  add column if not exists assigned_to text,
  add column if not exists resolution_note text,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.feedback_admin_audit (
  id bigint generated always as identity primary key,
  feedback_id bigint not null references public.user_feedback(id) on delete cascade,
  actor_uid text not null,
  actor_email text not null,
  action text not null,
  previous_status text not null,
  new_status text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists feedback_admin_audit_feedback_id_created_at_idx
  on public.feedback_admin_audit (feedback_id, created_at desc);

alter table public.feedback_admin_audit enable row level security;
revoke all on table public.feedback_admin_audit from anon, authenticated;
revoke all on table public.user_feedback from anon, authenticated;

drop policy if exists "No direct browser feedback audit access" on public.feedback_admin_audit;
create policy "No direct browser feedback audit access" on public.feedback_admin_audit
  for all to anon, authenticated using (false) with check (false);

drop policy if exists "No direct browser feedback access" on public.user_feedback;
create policy "No direct browser feedback access" on public.user_feedback
  for all to anon, authenticated using (false) with check (false);
