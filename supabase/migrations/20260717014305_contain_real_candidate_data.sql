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

REVOKE SELECT, INSERT, UPDATE, DELETE
ON TABLE public.welcomeflow_workspace_state
FROM PUBLIC, anon;

-- The application has no runtime dependency on this DDL event-trigger
-- function. Keep the function and event trigger, but remove public API access.
DO $$
BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated';
  END IF;
END
$$;

COMMIT;
