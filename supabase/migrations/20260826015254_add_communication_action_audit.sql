begin;

create table if not exists public.welcomeflow_communication_action_runs (
  action_run_id uuid primary key,
  workspace_id text not null check (workspace_id ~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$'),
  idempotency_key text not null check (idempotency_key ~ '^[a-f0-9]{64}$'),
  actor_user_id uuid not null,
  actor_role text not null check (char_length(actor_role) between 1 and 80),
  action_type text not null check (action_type in ('copy-subject', 'copy-body', 'open-email-draft')),
  action_center_item_id text not null check (char_length(action_center_item_id) between 1 and 1500),
  category text not null check (char_length(category) between 1 and 120),
  document_key text not null check (char_length(document_key) between 1 and 160),
  candidate_id text not null check (char_length(candidate_id) between 1 and 240),
  requisition_id text not null check (char_length(requisition_id) between 1 and 240),
  facility_id text not null check (char_length(facility_id) between 1 and 240),
  context_fingerprint text not null check (context_fingerprint ~ '^[a-f0-9]{64}$'),
  action_status text not null default 'approved' check (action_status in ('approved', 'succeeded', 'failed', 'cancelled')),
  result_code text not null default '',
  approved_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  retention_until timestamptz not null default (clock_timestamp() + interval '365 days'),
  created_at timestamptz not null default clock_timestamp(),
  unique (workspace_id, idempotency_key)
);

create table if not exists public.welcomeflow_communication_action_audit_events (
  event_id uuid primary key default gen_random_uuid(),
  action_run_id uuid not null references public.welcomeflow_communication_action_runs(action_run_id) on delete restrict,
  workspace_id text not null,
  actor_user_id uuid not null,
  event_type text not null check (event_type in ('approved', 'succeeded', 'failed', 'cancelled')),
  result_code text not null default '',
  occurred_at timestamptz not null default clock_timestamp(),
  retention_until timestamptz not null,
  unique (action_run_id, event_type)
);

alter table public.welcomeflow_communication_action_runs enable row level security;
alter table public.welcomeflow_communication_action_audit_events enable row level security;

revoke all privileges on table public.welcomeflow_communication_action_runs from public, anon, authenticated;
revoke all privileges on table public.welcomeflow_communication_action_audit_events from public, anon, authenticated;
grant select, insert, update, delete on table public.welcomeflow_communication_action_runs to service_role;
grant select, insert, update, delete on table public.welcomeflow_communication_action_audit_events to service_role;

create index if not exists welcomeflow_communication_action_runs_retention_idx
  on public.welcomeflow_communication_action_runs (retention_until);
create index if not exists welcomeflow_communication_action_events_retention_idx
  on public.welcomeflow_communication_action_audit_events (retention_until);
create index if not exists welcomeflow_communication_action_runs_context_idx
  on public.welcomeflow_communication_action_runs (workspace_id, candidate_id, requisition_id, facility_id, approved_at desc);

create or replace function public.welcomeflow_guard_communication_action_run()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if current_user <> 'service_role'
       or old.action_status <> 'approved'
       or new.action_status not in ('succeeded', 'failed', 'cancelled')
       or new.completed_at is null
       or new.result_code !~ '^[A-Z][A-Z0-9_]{0,79}$'
       or new.action_run_id <> old.action_run_id
       or new.workspace_id <> old.workspace_id
       or new.idempotency_key <> old.idempotency_key
       or new.actor_user_id <> old.actor_user_id
       or new.actor_role <> old.actor_role
       or new.action_type <> old.action_type
       or new.action_center_item_id <> old.action_center_item_id
       or new.category <> old.category
       or new.document_key <> old.document_key
       or new.candidate_id <> old.candidate_id
       or new.requisition_id <> old.requisition_id
       or new.facility_id <> old.facility_id
       or new.context_fingerprint <> old.context_fingerprint
       or new.approved_at <> old.approved_at
       or new.retention_until <> old.retention_until
       or new.created_at <> old.created_at then
      raise exception 'Communication action run identity and approval are immutable';
    end if;
  elsif tg_op = 'DELETE'
        and (current_user <> 'service_role' or old.retention_until > clock_timestamp()) then
    raise exception 'Communication action runs cannot be deleted before retention expires';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists welcomeflow_communication_action_run_guard
  on public.welcomeflow_communication_action_runs;
create trigger welcomeflow_communication_action_run_guard
before update or delete on public.welcomeflow_communication_action_runs
for each row execute function public.welcomeflow_guard_communication_action_run();

create or replace function public.welcomeflow_guard_communication_action_audit_event()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'Communication action audit events are immutable';
  end if;
  if tg_op = 'DELETE'
     and (current_user <> 'service_role' or old.retention_until > clock_timestamp()) then
    raise exception 'Communication action audit events cannot be deleted before retention expires';
  end if;
  return old;
end;
$$;

drop trigger if exists welcomeflow_communication_action_audit_immutable
  on public.welcomeflow_communication_action_audit_events;
create trigger welcomeflow_communication_action_audit_immutable
before update or delete on public.welcomeflow_communication_action_audit_events
for each row execute function public.welcomeflow_guard_communication_action_audit_event();

create or replace function public.welcomeflow_begin_communication_action(
  p_action_run_id uuid,
  p_workspace_id text,
  p_idempotency_key text,
  p_actor_user_id uuid,
  p_actor_role text,
  p_action_type text,
  p_action_center_item_id text,
  p_category text,
  p_document_key text,
  p_candidate_id text,
  p_requisition_id text,
  p_facility_id text,
  p_context_fingerprint text
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing public.welcomeflow_communication_action_runs%rowtype;
  retention_deadline timestamptz := clock_timestamp() + interval '365 days';
begin
  if p_action_run_id is null
     or p_actor_user_id is null
     or p_workspace_id !~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$'
     or p_idempotency_key !~ '^[a-f0-9]{64}$'
     or p_context_fingerprint !~ '^[a-f0-9]{64}$'
     or p_action_type not in ('copy-subject', 'copy-body', 'open-email-draft')
     or nullif(btrim(p_actor_role), '') is null or char_length(p_actor_role) > 80
     or nullif(btrim(p_action_center_item_id), '') is null or char_length(p_action_center_item_id) > 1500
     or nullif(btrim(p_category), '') is null or char_length(p_category) > 120
     or nullif(btrim(p_document_key), '') is null or char_length(p_document_key) > 160
     or nullif(btrim(p_candidate_id), '') is null or char_length(p_candidate_id) > 240
     or nullif(btrim(p_requisition_id), '') is null or char_length(p_requisition_id) > 240
     or nullif(btrim(p_facility_id), '') is null or char_length(p_facility_id) > 240 then
    return 'invalid';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_workspace_id || ':' || p_idempotency_key, 0));

  select * into existing
  from public.welcomeflow_communication_action_runs
  where workspace_id = p_workspace_id and idempotency_key = p_idempotency_key
  for update;

  if existing.action_run_id is not null then
    if existing.action_run_id = p_action_run_id
       and existing.actor_user_id = p_actor_user_id
       and existing.action_type = p_action_type
       and existing.action_center_item_id = p_action_center_item_id
       and existing.document_key = p_document_key
       and existing.candidate_id = p_candidate_id
       and existing.requisition_id = p_requisition_id
       and existing.facility_id = p_facility_id
       and existing.context_fingerprint = p_context_fingerprint then
      return 'duplicate_' || existing.action_status;
    end if;
    return 'conflict';
  end if;

  if exists (
    select 1 from public.welcomeflow_communication_action_runs
    where action_run_id = p_action_run_id
  ) then
    return 'conflict';
  end if;

  insert into public.welcomeflow_communication_action_runs (
    action_run_id, workspace_id, idempotency_key, actor_user_id, actor_role,
    action_type, action_center_item_id, category, document_key,
    candidate_id, requisition_id, facility_id, context_fingerprint,
    action_status, retention_until
  ) values (
    p_action_run_id, p_workspace_id, p_idempotency_key, p_actor_user_id, left(btrim(p_actor_role), 80),
    p_action_type, p_action_center_item_id, p_category, p_document_key,
    p_candidate_id, p_requisition_id, p_facility_id, p_context_fingerprint,
    'approved', retention_deadline
  );

  insert into public.welcomeflow_communication_action_audit_events (
    action_run_id, workspace_id, actor_user_id, event_type, result_code, retention_until
  ) values (
    p_action_run_id, p_workspace_id, p_actor_user_id, 'approved', 'RECRUITER_CONFIRMED', retention_deadline
  );

  return 'begun';
end;
$$;

create or replace function public.welcomeflow_complete_communication_action(
  p_action_run_id uuid,
  p_workspace_id text,
  p_actor_user_id uuid,
  p_result_status text,
  p_result_code text
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing public.welcomeflow_communication_action_runs%rowtype;
begin
  if p_action_run_id is null
     or p_actor_user_id is null
     or p_workspace_id !~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$'
     or p_result_status not in ('succeeded', 'failed', 'cancelled')
     or p_result_code !~ '^[A-Z][A-Z0-9_]{0,79}$' then
    return 'invalid';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_action_run_id::text, 0));
  select * into existing
  from public.welcomeflow_communication_action_runs
  where action_run_id = p_action_run_id
  for update;

  if existing.action_run_id is null
     or existing.workspace_id <> p_workspace_id
     or existing.actor_user_id <> p_actor_user_id then
    return 'not_found';
  end if;
  if existing.action_status <> 'approved' then
    if existing.action_status = p_result_status and existing.result_code = p_result_code then
      return 'duplicate_' || existing.action_status;
    end if;
    return 'conflict';
  end if;

  update public.welcomeflow_communication_action_runs
  set action_status = p_result_status,
      result_code = p_result_code,
      completed_at = clock_timestamp()
  where action_run_id = p_action_run_id and action_status = 'approved';

  insert into public.welcomeflow_communication_action_audit_events (
    action_run_id, workspace_id, actor_user_id, event_type, result_code, retention_until
  ) values (
    p_action_run_id, p_workspace_id, p_actor_user_id, p_result_status, p_result_code, existing.retention_until
  );

  return 'completed';
end;
$$;

create or replace function public.welcomeflow_purge_expired_communication_action_audit(
  p_limit integer default 1000
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  deleted_count integer := 0;
begin
  if p_limit < 1 or p_limit > 10000 then return 0; end if;
  create temporary table expired_communication_runs on commit drop as
    select action_run_id
    from public.welcomeflow_communication_action_runs
    where retention_until <= clock_timestamp()
    order by retention_until
    limit p_limit;

  delete from public.welcomeflow_communication_action_audit_events events
  using expired_communication_runs expired
  where events.action_run_id = expired.action_run_id;

  delete from public.welcomeflow_communication_action_runs runs
  using expired_communication_runs expired
  where runs.action_run_id = expired.action_run_id;
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all privileges on function public.welcomeflow_guard_communication_action_audit_event() from public, anon, authenticated;
revoke all privileges on function public.welcomeflow_guard_communication_action_run() from public, anon, authenticated;
revoke all privileges on function public.welcomeflow_begin_communication_action(uuid, text, text, uuid, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke all privileges on function public.welcomeflow_complete_communication_action(uuid, text, uuid, text, text) from public, anon, authenticated;
revoke all privileges on function public.welcomeflow_purge_expired_communication_action_audit(integer) from public, anon, authenticated;

grant execute on function public.welcomeflow_begin_communication_action(uuid, text, text, uuid, text, text, text, text, text, text, text, text, text) to service_role;
grant execute on function public.welcomeflow_complete_communication_action(uuid, text, uuid, text, text) to service_role;
grant execute on function public.welcomeflow_purge_expired_communication_action_audit(integer) to service_role;

commit;
