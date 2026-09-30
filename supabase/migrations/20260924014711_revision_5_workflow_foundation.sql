begin;

-- Additive store: no existing workspace row, policy, or candidate is rewritten.
create table public.welcomeflow_workflow_members (
  workspace_id text not null,
  user_id uuid not null,
  role text not null check (role in ('admin','recruiter','manager','interviewer','leadership')),
  display_name text not null,
  email text not null,
  timezone text not null,
  active boolean not null default true,
  version bigint not null default 1,
  primary key (workspace_id,user_id)
);
create table public.welcomeflow_workflow_state (
  workspace_id text primary key references public.welcomeflow_workspace_state(workspace_id) on delete restrict,
  revision bigint not null default 0,
  data jsonb not null,
  updated_at timestamptz not null default clock_timestamp(),
  check (jsonb_typeof(data)='object' and (data->>'revision')::bigint=revision)
);
create table public.welcomeflow_workflow_commands (
  workspace_id text not null,
  command_id text not null,
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  revision bigint not null,
  recorded_at timestamptz not null default clock_timestamp(),
  primary key (workspace_id,command_id),
  unique (workspace_id,revision)
);
create table public.welcomeflow_workflow_events (
  event_id bigint generated always as identity primary key,
  workspace_id text not null,
  command_id text not null,
  ordinal integer not null,
  actor_id text not null,
  actor_role text not null,
  type text not null,
  requisition_id text not null default '',
  case_id text not null default '',
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default clock_timestamp(),
  details jsonb not null default '{}',
  foreign key (workspace_id,command_id) references public.welcomeflow_workflow_commands(workspace_id,command_id) on delete restrict,
  unique(workspace_id,command_id,ordinal)
);
create index welcomeflow_workflow_events_case_idx on public.welcomeflow_workflow_events(workspace_id,case_id,event_id);

alter table public.welcomeflow_workflow_members enable row level security;
alter table public.welcomeflow_workflow_state enable row level security;
alter table public.welcomeflow_workflow_commands enable row level security;
alter table public.welcomeflow_workflow_events enable row level security;
revoke all on public.welcomeflow_workflow_members, public.welcomeflow_workflow_state, public.welcomeflow_workflow_commands, public.welcomeflow_workflow_events from public,anon,authenticated,service_role;
grant select,insert,update on public.welcomeflow_workflow_members, public.welcomeflow_workflow_state to service_role;
grant select,insert on public.welcomeflow_workflow_commands, public.welcomeflow_workflow_events to service_role;
revoke all on sequence public.welcomeflow_workflow_events_event_id_seq from public,anon,authenticated,service_role;
grant usage,select on sequence public.welcomeflow_workflow_events_event_id_seq to service_role;

create function public.welcomeflow_bump_workflow_member_version() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.workspace_id<>old.workspace_id or new.user_id<>old.user_id then
    raise exception 'Membership identity is immutable';
  end if;
  new.version := old.version+1;
  return new;
end;
$$;
create trigger welcomeflow_workflow_member_version before update on public.welcomeflow_workflow_members
for each row execute function public.welcomeflow_bump_workflow_member_version();
revoke all on function public.welcomeflow_bump_workflow_member_version() from public,anon,authenticated;

create function public.welcomeflow_commit_workflow(
  p_workspace_id text, p_expected_revision bigint, p_command_id text, p_fingerprint text,
  p_actor_id text, p_actor_role text, p_member_version bigint, p_source_updated_at timestamptz,
  p_state jsonb, p_events jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_revision bigint;
  v_fingerprint text;
  v_member public.welcomeflow_workflow_members%rowtype;
  v_source_time timestamptz;
  v_event jsonb;
  v_ordinal integer := 0;
begin
  if current_user <> 'service_role' then raise exception 'Workflow commits require the protected service'; end if;
  if p_workspace_id is null or length(p_workspace_id)>80 or p_command_id is null or length(p_command_id)>240
    or p_fingerprint !~ '^[a-f0-9]{64}$' or p_expected_revision is null or p_expected_revision<0
    or jsonb_typeof(p_state) is distinct from 'object' or jsonb_typeof(p_events) is distinct from 'array'
    or (p_state->>'revision')::bigint is distinct from p_expected_revision+1
    or jsonb_array_length(p_events)=0 or jsonb_array_length(p_events)>10000 then raise exception 'Invalid workflow commit'; end if;
  -- Lock before checking replay and revision; concurrent duplicate requests commit once.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('workflow:'||p_workspace_id,0));
  if p_actor_role not in ('system','candidate') then
    select * into v_member from public.welcomeflow_workflow_members
      where workspace_id=p_workspace_id and user_id::text=p_actor_id for share;
    if not found or not v_member.active or v_member.role<>p_actor_role or v_member.version<>p_member_version then
      return jsonb_build_object('status','unauthorized');
    end if;
  end if;
  select updated_at into v_source_time from public.welcomeflow_workspace_state where workspace_id=p_workspace_id for share;
  if not found or v_source_time is distinct from p_source_updated_at then return jsonb_build_object('status','source_conflict'); end if;
  select fingerprint into v_fingerprint from public.welcomeflow_workflow_commands where workspace_id=p_workspace_id and command_id=p_command_id;
  if found then return jsonb_build_object('status',case when v_fingerprint=p_fingerprint then 'duplicate' else 'command_conflict' end); end if;
  select revision into v_revision from public.welcomeflow_workflow_state where workspace_id=p_workspace_id for update;
  v_revision := coalesce(v_revision,0);
  if v_revision<>p_expected_revision then return jsonb_build_object('status','revision_conflict'); end if;
  insert into public.welcomeflow_workflow_commands(workspace_id,command_id,fingerprint,revision)
    values(p_workspace_id,p_command_id,p_fingerprint,p_expected_revision+1);
  for v_event in select value from jsonb_array_elements(p_events) loop
    if v_event->>'actorId' is distinct from p_actor_id or v_event->>'actorRole' is distinct from p_actor_role then
      raise exception 'Event actor must match authenticated command actor';
    end if;
    insert into public.welcomeflow_workflow_events(workspace_id,command_id,ordinal,actor_id,actor_role,type,requisition_id,case_id,occurred_at,details)
      values(p_workspace_id,p_command_id,v_ordinal,p_actor_id,p_actor_role,v_event->>'type',coalesce(v_event->>'requisitionId',''),coalesce(v_event->>'caseId',''),(v_event->>'occurredAt')::timestamptz,coalesce(v_event->'details','{}'::jsonb));
    v_ordinal := v_ordinal+1;
  end loop;
  insert into public.welcomeflow_workflow_state(workspace_id,revision,data) values(p_workspace_id,p_expected_revision+1,p_state)
    on conflict(workspace_id) do update set revision=excluded.revision,data=excluded.data,updated_at=clock_timestamp();
  return jsonb_build_object('status','committed','revision',p_expected_revision+1);
end;
$$;
revoke all on function public.welcomeflow_commit_workflow(text,bigint,text,text,text,text,bigint,timestamptz,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.welcomeflow_commit_workflow(text,bigint,text,text,text,text,bigint,timestamptz,jsonb,jsonb) to service_role;

-- No purge, public access, cron activation, or production data migration in this change.
commit;
