BEGIN;

ALTER TABLE public.welcomeflow_workspace_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "WelcomeFlow prototype read"
ON public.welcomeflow_workspace_state;

DROP POLICY IF EXISTS "WelcomeFlow prototype insert"
ON public.welcomeflow_workspace_state;

DROP POLICY IF EXISTS "WelcomeFlow prototype update"
ON public.welcomeflow_workspace_state;

DO $$
DECLARE
  unsafe_policy RECORD;
BEGIN
  FOR unsafe_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'welcomeflow_workspace_state'
      AND cmd IN ('ALL', 'INSERT', 'UPDATE', 'DELETE')
      AND ('public' = ANY(roles) OR 'anon' = ANY(roles))
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.welcomeflow_workspace_state', unsafe_policy.policyname);
  END LOOP;
END
$$;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.welcomeflow_workspace_state
FROM PUBLIC, anon;

COMMIT;

-- The application has no runtime dependency on this DDL event-trigger
-- function. This optional cleanup runs after mandatory containment commits so
-- an absent or misconfigured helper cannot roll back the table protections.
DO $$
BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Optional rls_auto_enable privilege cleanup failed: %', SQLSTATE;
END
$$;

-- Catalog verification is deliberately last and fail-closed. Mandatory
-- containment above is already committed even if this assertion aborts.
DO $$
DECLARE
  privilege_name TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'welcomeflow_workspace_state'
      AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'RLS is not enabled on public.welcomeflow_workspace_state';
  END IF;

  FOREACH privilege_name IN ARRAY ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']
  LOOP
    IF has_table_privilege('anon', 'public.welcomeflow_workspace_state', privilege_name) THEN
      RAISE EXCEPTION 'Unsafe anon workspace privilege remains: %', privilege_name;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'welcomeflow_workspace_state'
      AND cmd IN ('ALL', 'INSERT', 'UPDATE', 'DELETE')
      AND ('public' = ANY(roles) OR 'anon' = ANY(roles))
  ) THEN
    RAISE EXCEPTION 'Unsafe anonymous/public workspace write policy remains';
  END IF;

  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL
     AND (
       has_function_privilege('anon', 'public.rls_auto_enable()', 'EXECUTE')
       OR EXISTS (
         SELECT 1
         FROM pg_proc p
         CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
         WHERE p.oid = to_regprocedure('public.rls_auto_enable()')
           AND acl.grantee = 0
           AND acl.privilege_type = 'EXECUTE'
       )
     ) THEN
    RAISE EXCEPTION 'Unsafe rls_auto_enable EXECUTE privilege remains';
  END IF;
END
$$;
