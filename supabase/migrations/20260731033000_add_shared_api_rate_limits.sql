begin;

create table if not exists public.welcomeflow_api_rate_limits (
  action_name text not null,
  subject_hash text not null,
  window_bucket bigint not null,
  request_count integer not null default 1 check (request_count > 0),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (action_name, subject_hash, window_bucket)
);

alter table public.welcomeflow_api_rate_limits enable row level security;

revoke all privileges
on table public.welcomeflow_api_rate_limits
from public, anon, authenticated;

grant select, insert, update, delete
on table public.welcomeflow_api_rate_limits
to service_role;

create or replace function public.welcomeflow_consume_api_rate_limit(
  p_action text,
  p_subject text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_bucket bigint;
  accepted boolean := false;
begin
  if nullif(btrim(p_action), '') is null
     or nullif(btrim(p_subject), '') is null
     or p_limit < 1 or p_limit > 1000
     or p_window_seconds < 1 or p_window_seconds > 86400 then
    return false;
  end if;

  current_bucket := floor(extract(epoch from clock_timestamp()) / p_window_seconds)::bigint;

  insert into public.welcomeflow_api_rate_limits as limits (
    action_name,
    subject_hash,
    window_bucket,
    request_count,
    updated_at
  ) values (
    left(btrim(p_action), 80),
    left(btrim(p_subject), 160),
    current_bucket,
    1,
    clock_timestamp()
  )
  on conflict (action_name, subject_hash, window_bucket)
  do update set
    request_count = limits.request_count + 1,
    updated_at = clock_timestamp()
  where limits.request_count < p_limit
  returning true into accepted;

  return coalesce(accepted, false);
end;
$$;

revoke all privileges
on function public.welcomeflow_consume_api_rate_limit(text, text, integer, integer)
from public, anon, authenticated;

grant execute
on function public.welcomeflow_consume_api_rate_limit(text, text, integer, integer)
to service_role;

commit;
