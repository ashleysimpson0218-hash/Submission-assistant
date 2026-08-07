create table if not exists public.welcomeflow_workspace_state (
  workspace_id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.welcomeflow_workspace_state enable row level security;

-- Safe bootstrap contract:
--   * this shared workspace table is private by default;
--   * browser access is granted only by separately reviewed, narrowly scoped policies;
--   * rerunning this bootstrap must never restore anonymous writes to `default`.
drop policy if exists "WelcomeFlow prototype read" on public.welcomeflow_workspace_state;
drop policy if exists "WelcomeFlow prototype insert" on public.welcomeflow_workspace_state;
drop policy if exists "WelcomeFlow prototype update" on public.welcomeflow_workspace_state;

-- Remove every anonymous/public write-capable policy, including policies created
-- under names this bootstrap does not know about. SELECT access remains a
-- separate, explicitly reviewed concern.
do $$
declare
  unsafe_policy record;
begin
  for unsafe_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'welcomeflow_workspace_state'
      and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
      and ('public' = any(roles) or 'anon' = any(roles))
  loop
    execute format('drop policy if exists %I on public.welcomeflow_workspace_state', unsafe_policy.policyname);
  end loop;
end
$$;

revoke insert, update, delete, truncate, references, trigger
on table public.welcomeflow_workspace_state
from PUBLIC, anon;

-- Fail closed if either a direct grant or a role inherited from PUBLIC still
-- leaves a browser role capable of changing the workspace table.
do $$
declare
  privilege_name text;
begin
  foreach privilege_name in array array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']
  loop
    if has_table_privilege('anon', 'public.welcomeflow_workspace_state', privilege_name) then
      raise exception 'Unsafe anon workspace privilege remains: %', privilege_name;
    end if;
  end loop;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'welcomeflow_workspace_state'
      and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
      and ('public' = any(roles) or 'anon' = any(roles))
  ) then
    raise exception 'Unsafe anonymous/public workspace write policy remains';
  end if;
end
$$;
