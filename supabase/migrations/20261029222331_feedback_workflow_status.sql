alter table public.user_feedback
  drop constraint if exists user_feedback_status_check;

update public.user_feedback
set status = 'reviewing'
where status = 'reviewed';

alter table public.user_feedback
  add constraint user_feedback_status_check
  check (status in ('new', 'reviewing', 'resolved', 'closed'));
