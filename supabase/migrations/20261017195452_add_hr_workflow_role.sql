begin;

alter table public.welcomeflow_workflow_members
  drop constraint if exists welcomeflow_workflow_members_role_check;

alter table public.welcomeflow_workflow_members
  add constraint welcomeflow_workflow_members_role_check
  check (role in ('admin','recruiter','hr','manager','interviewer','leadership'));

commit;