# Workflow Worker Scheduling

WelcomeFlow schedules the durable workflow worker every five minutes through Supabase Cron. The scheduled database function calls the authenticated `/api/workflow-schedule` endpoint, which processes each workspace in the server-side `WELCOMEFLOW_API_WORKSPACE_IDS` allowlist.

The migration is safe to apply before activation. It remains dormant until both Vault secrets exist:

- `welcomeflow_worker_origin`: the stable HTTPS production origin with no trailing slash.
- `welcomeflow_worker_secret`: the same 32-character-or-longer value configured as the server-only Vercel variable `WELCOMEFLOW_WORKFLOW_WORKER_SECRET`.

Create or update those values in **Supabase Dashboard → Project Settings → Vault**, then redeploy the application after configuring the matching Vercel secret. Never place the worker secret in a client variable, repository file, or cron command text.

The scheduler runs `*/5 * * * *`. Monitor `cron.job_run_details`, the workflow `lastWorkerAt` heartbeat, and the application exception queue. A successful HTTP request only means the worker invocation completed; individual provider outcomes remain recorded in the workflow audit and outbox state.

Vercel Cron is not the primary scheduler for this project because Hobby cron is limited to daily execution and Vercel invokes cron only on production deployments. Supabase Cron provides the timing needed for reminder eligibility and stale-send reconciliation while keeping the shared secret encrypted in Vault.

References:

- https://supabase.com/docs/guides/functions/schedule-functions
- https://supabase.com/docs/guides/database/vault
- https://vercel.com/docs/cron-jobs
