begin;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create schema if not exists welcomeflow_private;
revoke all on schema welcomeflow_private from public, anon, authenticated;

create or replace function welcomeflow_private.schedule_workflow_worker()
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  worker_origin text;
  worker_secret text;
  request_id bigint;
begin
  select decrypted_secret into worker_origin
  from vault.decrypted_secrets
  where name = 'welcomeflow_worker_origin'
  limit 1;

  select decrypted_secret into worker_secret
  from vault.decrypted_secrets
  where name = 'welcomeflow_worker_secret'
  limit 1;

  if worker_origin is null or worker_origin !~ '^https://[^/]+$' or
     worker_secret is null or length(worker_secret) < 32 then
    return null;
  end if;

  select net.http_post(
    url := worker_origin || '/api/workflow-schedule',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || worker_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  ) into request_id;

  return request_id;
end;
$$;

revoke all on function welcomeflow_private.schedule_workflow_worker() from public, anon, authenticated;

do $$
declare
  existing_job bigint;
begin
  for existing_job in
    select jobid from cron.job where jobname = 'welcomeflow-workflow-worker'
  loop
    perform cron.unschedule(existing_job);
  end loop;

  perform cron.schedule(
    'welcomeflow-workflow-worker',
    '*/5 * * * *',
    'select welcomeflow_private.schedule_workflow_worker();'
  );
end;
$$;

commit;
