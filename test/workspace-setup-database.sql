-- NOT RUN in this change. Requires the staged function in a disposable PostgreSQL
-- database with the WelcomeFlow schema and Supabase roles. Never use a live workspace.
-- Example only: psql <disposable-connection> -v WF_DISPOSABLE_TEST=true \
--   -v expected_database=<disposable-name> -f test/workspace-setup-database.sql
\set ON_ERROR_STOP on
\if :{?WF_DISPOSABLE_TEST}
\else
  \echo 'Refusing: explicit disposable-test confirmation is required.'
  \quit 2
\endif
\if :WF_DISPOSABLE_TEST
\else
  \echo 'Refusing: disposable-test confirmation is false.'
  \quit 2
\endif
\if :{?expected_database}
\else
  \echo 'Refusing: expected_database must be specified.'
  \quit 2
\endif
select current_database() = :'expected_database'
  and coalesce(current_setting('welcomeflow.disposable_test',true) = 'true',false) as scope_verified \gset
\if :scope_verified
\else
  \echo 'Refusing: database identity or disposable marker did not match.'
  \quit 2
\endif

begin;
set local role service_role;
insert into public.welcomeflow_workspace_state(workspace_id,data,updated_at) values
 ('wf-setup-fixture-a','{"settings":{"general":{"companyName":"Example A","privateMarker":"preserve"},"templates":{"sentinel":"unchanged"}},"tracker":[{"id":"fictional-only"}]}','2026-10-24T10:00:00.000001Z'),
 ('wf-setup-fixture-b','{"settings":{"general":{"companyName":"Example B"}}}','2026-10-24T10:00:00.000001Z');
insert into public.welcomeflow_workflow_members(workspace_id,user_id,role,display_name,email,timezone,active) values
 ('wf-setup-fixture-a','00000000-0000-4000-8000-000000000101','recruiter','Example Recruiter','recruiter@example.test','UTC',true),
 ('wf-setup-fixture-a','00000000-0000-4000-8000-000000000102','manager','Example Manager','manager@example.test','UTC',true),
 ('wf-setup-fixture-b','00000000-0000-4000-8000-000000000103','admin','Example Admin','admin@example.test','UTC',true);

do $checks$
declare
  r jsonb;
  saved jsonb;
  saved_time timestamptz;
  original_time constant timestamptz := '2026-10-24T10:00:00.000001Z';
  actor constant uuid := '00000000-0000-4000-8000-000000000101';
begin
  r:=public.welcomeflow_access_workspace_setup('wf-setup-fixture-a',actor,'recruiter','read',null,'{}');
  if r->>'status' is distinct from 'loaded' or r->'fields' is distinct from '{"companyName":"Example A"}'::jsonb then
    raise exception 'Read must return only allowed setup fields';
  end if;
  r:=public.welcomeflow_access_workspace_setup('wf-setup-fixture-b',actor,'recruiter','read',null,'{}');
  if r->>'status' is distinct from 'forbidden' then raise exception 'Cross-company read allowed'; end if;
  r:=public.welcomeflow_access_workspace_setup('wf-setup-fixture-a','00000000-0000-4000-8000-000000000102','manager','read',null,'{}');
  if r->>'status' is distinct from 'forbidden' then raise exception 'Manager setup access allowed'; end if;
  r:=public.welcomeflow_access_workspace_setup('wf-setup-fixture-a',actor,'admin','read',null,'{}');
  if r->>'status' is distinct from 'forbidden' then raise exception 'Claimed role bypassed current membership'; end if;

  r:=public.welcomeflow_access_workspace_setup('wf-setup-fixture-a',actor,'recruiter','save',original_time,'{"companyName":"Updated Example","recruiterEmail":"recruiter@example.test"}');
  if r->>'status' is distinct from 'saved' or r->'fields'->>'companyName' is distinct from 'Updated Example' then raise exception 'Authorized save failed'; end if;
  saved_time := (r->>'updatedAt')::timestamptz;
  if saved_time is null or saved_time <= original_time then raise exception 'Save version did not advance'; end if;
  select data into saved from public.welcomeflow_workspace_state where workspace_id='wf-setup-fixture-a';
  if saved#>>'{settings,general,privateMarker}' is distinct from 'preserve'
    or saved#>>'{settings,templates,sentinel}' is distinct from 'unchanged'
    or saved->'tracker' is distinct from '[{"id":"fictional-only"}]'::jsonb then raise exception 'Unrelated state changed'; end if;
  r:=public.welcomeflow_access_workspace_setup('wf-setup-fixture-a',actor,'recruiter','read',null,'{}');
  if r->'fields'->>'companyName' is distinct from 'Updated Example' or (r->>'updatedAt')::timestamptz is distinct from saved_time then raise exception 'Reload did not match committed edit'; end if;
  r:=public.welcomeflow_access_workspace_setup('wf-setup-fixture-a',actor,'recruiter','save',original_time,'{"companyName":"Stale overwrite"}');
  if r->>'status' is distinct from 'conflict' then raise exception 'Stale write accepted'; end if;
  r:=public.welcomeflow_access_workspace_setup('wf-setup-fixture-a',actor,'recruiter','save',saved_time,'{"tracker":[]}');
  if r->>'status' is distinct from 'invalid' then raise exception 'Unapproved field accepted'; end if;
  r:=public.welcomeflow_access_workspace_setup('wf-setup-fixture-a',actor,'recruiter','save',saved_time,'{"includeSignatureLineInEmails":"true"}');
  if r->>'status' is distinct from 'invalid' then raise exception 'Wrong field type accepted'; end if;

  update public.welcomeflow_workflow_members set active=false where workspace_id='wf-setup-fixture-a' and user_id=actor;
  r:=public.welcomeflow_access_workspace_setup('wf-setup-fixture-a',actor,'recruiter','save',saved_time,'{"companyName":"Removed member"}');
  if r->>'status' is distinct from 'forbidden' then raise exception 'Removed member saved'; end if;
  update public.welcomeflow_workflow_members set active=true,role='manager' where workspace_id='wf-setup-fixture-a' and user_id=actor;
  r:=public.welcomeflow_access_workspace_setup('wf-setup-fixture-a',actor,'recruiter','read',null,'{}');
  if r->>'status' is distinct from 'forbidden' then raise exception 'Demotion ignored'; end if;
  if has_function_privilege('anon','public.welcomeflow_access_workspace_setup(text,uuid,text,text,timestamptz,jsonb)','EXECUTE')
    or has_function_privilege('authenticated','public.welcomeflow_access_workspace_setup(text,uuid,text,text,timestamptz,jsonb)','EXECUTE') then
    raise exception 'Browser role can directly execute privileged function';
  end if;
end;
$checks$;
rollback;
\echo 'Disposable transaction checks passed and fictional fixtures rolled back.'
