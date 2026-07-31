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

revoke select, insert, update, delete
on table public.welcomeflow_workspace_state
from anon;
