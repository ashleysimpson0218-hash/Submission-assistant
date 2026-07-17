BEGIN;

REVOKE ALL PRIVILEGES
ON TABLE public.welcomeflow_workspace_state
FROM anon;

REVOKE ALL PRIVILEGES
ON TABLE public.welcomeflow_workspace_state
FROM authenticated;

COMMIT;
