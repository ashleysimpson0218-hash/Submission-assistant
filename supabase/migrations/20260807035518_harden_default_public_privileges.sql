begin;

-- The recovered remote baseline granted broad default privileges to browser
-- roles. Remove those defaults before any later WelcomeFlow objects are
-- created. Existing objects remain governed by their explicit grants and RLS.
alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all on sequences from public, anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all on functions from public, anon, authenticated;

-- The application uses server-authorized service-role access. Browser roles
-- must not acquire direct access to the preserved workspace state.
revoke all privileges
on table public.welcomeflow_workspace_state
from public, anon, authenticated;

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end
$$;

commit;

-- Fail closed if the recovered defaults or object-level privileges remain.
do $$
declare
  privilege_name text;
begin
  if exists (
    select 1
    from pg_default_acl defaults
    cross join lateral aclexplode(defaults.defaclacl) privilege
    join pg_namespace namespace
      on namespace.oid = defaults.defaclnamespace
    where namespace.nspname = 'public'
      and defaults.defaclobjtype in ('r', 'S', 'f')
      and (
        privilege.grantee = 0
        or pg_get_userbyid(privilege.grantee) in ('anon', 'authenticated')
      )
  ) then
    raise exception 'Unsafe public/anon/authenticated default privileges remain in schema public';
  end if;

  foreach privilege_name in array array[
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
  ]
  loop
    if has_table_privilege('anon', 'public.welcomeflow_workspace_state', privilege_name)
       or has_table_privilege('authenticated', 'public.welcomeflow_workspace_state', privilege_name) then
      raise exception 'Unsafe workspace privilege remains: %', privilege_name;
    end if;
  end loop;

  if to_regprocedure('public.rls_auto_enable()') is not null
     and (
       has_function_privilege('anon', 'public.rls_auto_enable()', 'EXECUTE')
       or has_function_privilege('authenticated', 'public.rls_auto_enable()', 'EXECUTE')
       or exists (
         select 1
         from pg_proc function_record
         cross join lateral aclexplode(
           coalesce(
             function_record.proacl,
             acldefault('f', function_record.proowner)
           )
         ) privilege
         where function_record.oid = to_regprocedure('public.rls_auto_enable()')
           and privilege.grantee = 0
           and privilege.privilege_type = 'EXECUTE'
       )
     ) then
    raise exception 'Unsafe rls_auto_enable EXECUTE privilege remains';
  end if;
end
$$;
