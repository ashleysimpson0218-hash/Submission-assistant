begin;

alter table public.welcomeflow_workflow_members force row level security;
alter table public.welcomeflow_workflow_state force row level security;
alter table public.welcomeflow_workflow_commands force row level security;
alter table public.welcomeflow_workflow_events force row level security;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'welcomeflow_workflow_state_workspace_fk'
  ) then
    alter table public.welcomeflow_workflow_state
      add constraint welcomeflow_workflow_state_workspace_fk
      foreign key (workspace_id)
      references public.welcomeflow_workspace_state(workspace_id)
      on delete restrict;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'welcomeflow_workflow_members_workspace_fk'
  ) then
    alter table public.welcomeflow_workflow_members
      add constraint welcomeflow_workflow_members_workspace_fk
      foreign key (workspace_id)
      references public.welcomeflow_workspace_state(workspace_id)
      on delete restrict;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'welcomeflow_workflow_commands_workspace_fk'
  ) then
    alter table public.welcomeflow_workflow_commands
      add constraint welcomeflow_workflow_commands_workspace_fk
      foreign key (workspace_id)
      references public.welcomeflow_workspace_state(workspace_id)
      on delete restrict;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'welcomeflow_workflow_events_workspace_fk'
  ) then
    alter table public.welcomeflow_workflow_events
      add constraint welcomeflow_workflow_events_workspace_fk
      foreign key (workspace_id)
      references public.welcomeflow_workspace_state(workspace_id)
      on delete restrict;
  end if;
end;
$$;

revoke all privileges on table
  public.welcomeflow_workflow_members,
  public.welcomeflow_workflow_state,
  public.welcomeflow_workflow_commands,
  public.welcomeflow_workflow_events
from public, anon, authenticated;

do $$
declare
  unsafe_count bigint;
begin
  select count(*) into unsafe_count
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name in (
      'welcomeflow_workflow_members',
      'welcomeflow_workflow_state',
      'welcomeflow_workflow_commands',
      'welcomeflow_workflow_events'
    )
    and grantee in ('PUBLIC', 'anon', 'authenticated');
  if unsafe_count <> 0 then
    raise exception 'unsafe workflow tenant grants remain';
  end if;
end;
$$;

commit;