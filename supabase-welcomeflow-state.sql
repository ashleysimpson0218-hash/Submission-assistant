create table if not exists public.welcomeflow_workspace_state (
  workspace_id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.welcomeflow_workspace_state enable row level security;

drop policy if exists "WelcomeFlow prototype read" on public.welcomeflow_workspace_state;
drop policy if exists "WelcomeFlow prototype insert" on public.welcomeflow_workspace_state;
drop policy if exists "WelcomeFlow prototype update" on public.welcomeflow_workspace_state;

create policy "WelcomeFlow prototype read"
  on public.welcomeflow_workspace_state
  for select
  to anon
  using (workspace_id = 'default');

create policy "WelcomeFlow prototype insert"
  on public.welcomeflow_workspace_state
  for insert
  to anon
  with check (workspace_id = 'default');

create policy "WelcomeFlow prototype update"
  on public.welcomeflow_workspace_state
  for update
  to anon
  using (workspace_id = 'default')
  with check (workspace_id = 'default');
