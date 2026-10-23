alter table public.user_feedback
  add column if not exists email_delivery_status text not null default 'pending'
    check (email_delivery_status in ('pending', 'sent', 'not_configured', 'failed')),
  add column if not exists email_delivery_attempts integer not null default 0
    check (email_delivery_attempts between 0 and 3),
  add column if not exists email_delivery_error text,
  add column if not exists email_delivered_at timestamptz,
  add column if not exists resolved_at timestamptz;

alter table public.user_feedback
  add constraint user_feedback_email_delivery_error_length
    check (email_delivery_error is null or char_length(email_delivery_error) <= 500);

comment on column public.user_feedback.email_delivery_status is
  'Server-managed feedback notification delivery state.';
