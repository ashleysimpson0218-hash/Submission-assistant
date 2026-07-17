BEGIN;

DROP POLICY IF EXISTS "WelcomeFlow prototype read"
ON public.welcomeflow_workspace_state;

DROP POLICY IF EXISTS "WelcomeFlow prototype insert"
ON public.welcomeflow_workspace_state;

DROP POLICY IF EXISTS "WelcomeFlow prototype update"
ON public.welcomeflow_workspace_state;

REVOKE SELECT, INSERT, UPDATE, DELETE
ON TABLE public.welcomeflow_workspace_state
FROM anon;

-- The application has no runtime dependency on this DDL event-trigger
-- function. Keep the function and event trigger, but remove public API access.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()
FROM PUBLIC, anon, authenticated;

COMMIT;
