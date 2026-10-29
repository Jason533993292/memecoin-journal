create table if not exists public.feedback_delivery_jobs (
  feedback_id bigint primary key references public.user_feedback(id) on delete cascade,
  attempts integer not null default 0 check (attempts between 0 and 20),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  lock_token uuid,
  last_error text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (last_error is null or char_length(last_error) <= 500)
);

create index if not exists feedback_delivery_jobs_pending_idx
  on public.feedback_delivery_jobs (next_attempt_at)
  where completed_at is null;

alter table public.feedback_delivery_jobs enable row level security;
revoke all on table public.feedback_delivery_jobs from public, anon, authenticated;
grant select, insert, update, delete on table public.feedback_delivery_jobs to service_role;

drop policy if exists "No direct browser feedback queue access" on public.feedback_delivery_jobs;
create policy "No direct browser feedback queue access" on public.feedback_delivery_jobs
  for all to anon, authenticated using (false) with check (false);

create or replace function public.claim_feedback_delivery_jobs(batch_size integer, worker_token uuid)
returns setof public.feedback_delivery_jobs
language sql
security invoker
set search_path = ''
as $$
  update public.feedback_delivery_jobs as job
  set attempts = job.attempts + 1,
      locked_at = now(),
      lock_token = worker_token,
      updated_at = now()
  where job.feedback_id in (
    select candidate.feedback_id
    from public.feedback_delivery_jobs as candidate
    where candidate.completed_at is null
      and candidate.next_attempt_at <= now()
      and (candidate.locked_at is null or candidate.locked_at < now() - interval '10 minutes')
    order by candidate.next_attempt_at, candidate.feedback_id
    for update skip locked
    limit least(greatest(batch_size, 1), 25)
  )
  returning job.*;
$$;

revoke all on function public.claim_feedback_delivery_jobs(integer, uuid) from public, anon, authenticated;
grant execute on function public.claim_feedback_delivery_jobs(integer, uuid) to service_role;

comment on table public.feedback_delivery_jobs is
  'Private durable outbox for feedback email delivery. Claimed atomically with short expiring locks.';
