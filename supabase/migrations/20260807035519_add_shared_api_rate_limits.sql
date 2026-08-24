begin;

create table if not exists public.welcomeflow_api_rate_limits (
  action_name text not null,
  subject_hash text not null,
  window_bucket bigint not null,
  request_count integer not null default 1 check (request_count > 0),
  updated_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default (clock_timestamp() + interval '2 minutes'),
  primary key (action_name, subject_hash, window_bucket)
);

alter table public.welcomeflow_api_rate_limits enable row level security;

revoke all privileges
on table public.welcomeflow_api_rate_limits
from public, anon, authenticated;

grant select, insert, update, delete
on table public.welcomeflow_api_rate_limits
to service_role;

create index if not exists welcomeflow_api_rate_limits_expires_at_idx
on public.welcomeflow_api_rate_limits (expires_at);

create or replace function public.welcomeflow_consume_api_rate_limits(
  p_action text,
  p_subject_hashes text[],
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
  subject_hash text;
  window_expires_at timestamptz;
begin
  if nullif(btrim(p_action), '') is null
     or cardinality(p_subject_hashes) < 2
     or cardinality(p_subject_hashes) > 8
     or exists (select 1 from unnest(p_subject_hashes) as subjects(subject_hash) where subject_hash !~ '^[a-f0-9]{64}$')
     or cardinality(p_subject_hashes) <> cardinality(array(select distinct subject_hash from unnest(p_subject_hashes) as subjects(subject_hash)))
     or p_limit < 1 or p_limit > 1000
     or p_window_seconds < 1 or p_window_seconds > 86400 then
    return false;
  end if;

  current_bucket := floor(extract(epoch from clock_timestamp()) / p_window_seconds)::bigint;
  window_expires_at := to_timestamp((current_bucket + 2) * p_window_seconds);

  -- Serialize every dimension in a deterministic order. This avoids a race
  -- where two first requests could both pass an empty-row precheck.
  for subject_hash in select value from unnest(p_subject_hashes) as subjects(value) order by value
  loop
    perform pg_advisory_xact_lock(hashtextextended(left(btrim(p_action), 80) || ':' || subject_hash || ':' || current_bucket, 0));
  end loop;

  if exists (
    select 1
    from unnest(p_subject_hashes) as subjects(subject_hash)
    join public.welcomeflow_api_rate_limits limits
      on limits.action_name = left(btrim(p_action), 80)
     and limits.subject_hash = subjects.subject_hash
     and limits.window_bucket = current_bucket
    where limits.request_count >= p_limit
  ) then
    return false;
  end if;

  insert into public.welcomeflow_api_rate_limits as limits (
    action_name,
    subject_hash,
    window_bucket,
    request_count,
    updated_at,
    expires_at
  ) select
    left(btrim(p_action), 80),
    subjects.subject_hash,
    current_bucket,
    1,
    clock_timestamp(),
    window_expires_at
  from unnest(p_subject_hashes) as subjects(subject_hash)
  on conflict (action_name, subject_hash, window_bucket)
  do update set
    request_count = limits.request_count + 1,
    updated_at = clock_timestamp(),
    expires_at = excluded.expires_at;

  delete from public.welcomeflow_api_rate_limits
  where expires_at < clock_timestamp();

  return true;
end;
$$;

revoke all privileges
on function public.welcomeflow_consume_api_rate_limits(text, text[], integer, integer)
from public, anon, authenticated;

grant execute
on function public.welcomeflow_consume_api_rate_limits(text, text[], integer, integer)
to service_role;

commit;
