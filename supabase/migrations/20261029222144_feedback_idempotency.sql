alter table public.user_feedback
  add column if not exists idempotency_key uuid;

update public.user_feedback
set idempotency_key = gen_random_uuid()
where idempotency_key is null;

alter table public.user_feedback
  alter column idempotency_key set not null;

create unique index if not exists user_feedback_user_id_idempotency_key_idx
  on public.user_feedback (user_id, idempotency_key);

comment on column public.user_feedback.idempotency_key is
  'Browser-generated submission identifier used to make authenticated feedback retries duplicate-safe.';
