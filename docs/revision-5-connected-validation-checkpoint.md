# Revision 5 — connected validation checkpoint

September 27, 2026. Status: **incomplete; not ready for acceptance or release**.

The CEO approved the local checkpoint and authorized connected non-production validation. Production deployment and activation remain prohibited. The previously accepted 1,030 regression tests / 84 suites, 21 workflow tests, local SQL checks, mocked-API browser checks, and build remain historical local evidence; they are not connected acceptance results.

## Update: restoration and recipient approval confirmed

The following update supersedes the restoration/recipient blockers below; the earlier checkpoint remains as historical evidence.

- WelcomeFlow Test now reports `ACTIVE_HEALTHY`. Its original workspace table and five July migration records are present. The transient empty-schema result during restoration was not the final restored baseline.
- Verified the workspace primary key, required column types/non-null constraints, and service SELECT/UPDATE privileges before applying Revision 5.
- Applied the corrected additive migration to **WelcomeFlow Test only**. Remote migration version: `20260927223541`, name `revision_5_workflow_foundation`; repository source filename remains `20260924014711_revision_5_workflow_foundation.sql`. The connector assigned the remote timestamp; future migration reconciliation must account for this mapping, not reapply the same DDL.
- Connected grant checks passed: all four workflow tables have RLS enabled; anonymous/authenticated roles cannot select them; service role cannot UPDATE, DELETE, or TRUNCATE commands/events.
- Connected RPC/sequence checks passed: anonymous/authenticated roles cannot execute the commit function or use the audit sequence; service role can.
- Existing workspace records were not modified. No test users, memberships, candidate records, worker activation, email sending, or deployment was performed.

Approved exact test recipients:

| Test role | Approved address |
| --- | --- |
| Recruiter | ashleysimpson0218@gmail.com |
| Manager / stage owner | central54llc@outlook.com |
| Synthetic candidate | chicagoroxi@gmail.com |

These addresses are approved only for synthetic records in WelcomeFlow Test. Configure `WELCOMEFLOW_EMAIL_ALLOWED_RECIPIENTS` with these three addresses and leave `WELCOMEFLOW_EMAIL_ALLOWED_DOMAINS` empty. Approval is recorded here; runtime allowlisting is not yet configured.

Remaining blocker: secure authenticated test runtime, user provisioning, provider/sender configuration, worker and candidate-link secrets. Credentials must be provisioned securely, never in chat, source, or evidence. Available connectors do not provide the required runtime configuration access, and this execution workspace has none of those credentials. No further product or recipient approval is needed. A01–A15 remain unexecuted against the connected application.

## Earlier connected evidence and actions

- Confirmed approved Supabase target: **WelcomeFlow Test**, `bjverobaoujhfaylyrzi`, matching the repository release baseline.
- Project was `INACTIVE`. Requested restoration of this test project; provider returned success. Subsequent project status remained `COMING_UP` during this checkpoint.
- Initial migration listing timed out; an initial SQL query was refused. Later SQL queries succeeded, but returned no public application tables, no migration entries, and zero Auth users. These observations occurred during restoration and do not establish that prior data is lost. Do not reconstruct or overwrite a restoring database.
- Read actual PostgreSQL default privileges. New tables inherit broad privileges for `service_role`, `anon`, and `authenticated`.
- Inspected Vercel project metadata for `submission-assistant-85w9`. This does not establish a configured Revision 5 test deployment or its environment settings.
- No application migration applied, test user created, worker started, email sent, deployment created, or production configuration changed in this checkpoint. The only remote state change was the approved test-project restore request.

## Defect found and corrected

**Inherited service permissions undermined audit immutability.** The original workflow migration granted limited permissions without first revoking the broader service-role permissions inherited on this connected project's new tables. A grant alone does not remove existing UPDATE, DELETE, or TRUNCATE rights.

The unapplied workflow migration now revokes inherited table privileges from `service_role` before granting only required rights. The audit sequence also explicitly revokes inherited browser-role permissions before granting service access. The isolated SQL test now models those broad defaults and asserts that command/event UPDATE, DELETE, and TRUNCATE privileges are absent and browser roles lack sequence usage.

This is a correction to implement the approved audit boundary, not a product-specification change. Remote application and verification remain pending.

## Local verification of this correction

- Strengthened SQL acceptance script: passed, including Supabase-style inherited grants, transaction rollback, deduplication, stale revision/source checks, membership revocation, and private role boundaries.
- `CI=true npm run build`: passed. This compiled an artifact locally; it did not deploy anything.
- `git diff --check`: passed.
- The full regression suite was not repeated for this SQL/test-only correction. Its accepted results remain from the prior checkpoint.

## Acceptance status

| Scenarios | Connected status | Remaining evidence |
| --- | --- | --- |
| A01 handoff/deduplication; A02 ownership; A03 single-stage; A04 multi-stage; A05 Hold/Decline; A06 withdrawal | Blocked / not executed | Restored baseline, additive migration, authenticated test identities, protected API |
| A07 after-hours; A08 lead-time boundaries; A09 consolidation | Blocked / not executed | Connected worker, approved test mailboxes, provider configuration and receipt evidence |
| A10 candidate check-in; A11 manager batching | Blocked / not executed | Connected stage progression, worker, scoped authenticated views and email evidence |
| A12 unknown-result/bounce recovery | Blocked / not executed | Controlled provider acceptance/delivery/failure fixtures and supervised recovery |
| A13 stale/concurrent requests | Blocked / not executed | Actual simultaneous protected API requests against the migrated database |
| A14 draft is not completion; A15 mobile forms | Not rerun against connected environment | Configured authenticated test deployment; browser results must use actual API responses |

**Connected A01–A15 passes: 0.** None of these scenarios has been demonstrated to fail in the connected application; they have not yet been executed. Infrastructure startup failures and the permission defect above are separately recorded, not hidden as acceptance passes.

## Required next inputs and work

1. Confirm restoration finishes and re-read schema/migration history before any DDL. Compare with tracked baseline migrations. If the application baseline is still absent, resolve that infrastructure mismatch before applying the additive workflow migration.
2. Provide a secure test-only runtime configuration: approved project's public and server credentials, authenticated synthetic user provisioning access, and a reachable protected test deployment. Do not paste service keys or passwords into chat. Current available connectors do not expose server credentials or environment-variable configuration; none are configured in this execution workspace.
3. Name the exact approved test recipient addresses and provide test-only Resend sender/provider configuration through the secure runtime. Use exact-address allowlisting; no broad domain or real-candidate recipients.
4. Generate new test-only worker and candidate-link secrets, restrict the runtime to a dedicated synthetic workspace, and enable workflow/email flags only in that isolated environment after its guards are verified. Keep every unrelated environment unchanged.
5. Apply the reviewed additive migration, provision synthetic memberships and candidates, execute A01–A15, include simultaneous requests, check advisor findings, and capture sanitized request IDs, timestamps, database event/receipt IDs, provider IDs, and browser evidence. Poll/reconcile provider results without treating acceptance as delivery. Inject unknown results only within the test harness; never use real recipients for failure testing.

No settled CEO decision needs reopening. The missing items are infrastructure/access and recipient configuration, not product choices.

## Proposed production release plan — NOT AUTHORIZED OR EXECUTED

1. Complete connected A01–A15 evidence with no unresolved release-blocking failures. Obtain separate CEO acceptance and production-release approval identifying the reviewed commit, production workspace, pilot users, sender/recipients, release window, and accountable operator.
2. Before changing production, verify current deployment identity, maintenance/feature flags, production migration history, backup/recovery readiness, identity provisioning, and existing security release blockers. Resolve those blockers; do not infer readiness from this feature's tests. Verify rollback to the current production artifact is available.
3. Compare the exact approved additive migration against the production schema. Apply only after compatibility and backup checks pass. Run read-only schema/grant checks: RLS enabled, browser table/RPC access denied, service-role command/event mutation privileges denied. Do not import test records or copy candidate data between environments.
4. Deploy the approved application artifact with workflow and email flags **off** and no worker running. Confirm existing functionality and protected-route denials before enabling any workflow. Never expose server secrets to the client build.
5. Provision the explicitly approved pilot memberships, requisition ownership/stage plans, communication policy, designated data authorities, escalation owner, exact workspace allowlist, sender and approved recipient policy. Generate distinct production secrets. Resolve missing ownership/permission/timezone through human review.
6. Enable only the approved pilot scope, start the supervised worker, and observe the first reviewed handoff, manager decision, reservation, confirmation, delivery reconciliation, and exception recovery. Confirm individual audit records and consolidated communication. Do not enable deferred integrations or scheduling modes.
7. Stop the pilot if unauthorized visibility, duplicate motion/email, incorrect completion, stage skipping, unknown-result replay, or missing recovery occurs. Disable new workflow actions and scheduled worker sends; retain state, events, receipts and reservations. Reconcile in-flight sends before retrying. Preserve additive tables; no destructive database rollback. Revert application artifact only after checking compatibility with retained state.
8. Expand only after the pilot evidence is reviewed and separately authorized. The worker requires an accountable operator, heartbeat monitoring, exception response, and delivery reconciliation throughout operation.

The production host, exact artifact hash, pilot recipients and release time remain unselected pending connected acceptance and the separate release decision. This is an executable sequence proposal, not a claim that production prerequisites are satisfied.

## Scope confirmation

No browser extensions, direct calendar/self-service scheduling, candidate-proposed alternates, ATS/Paycom integration, credentialing, detailed onboarding, or other deferred functionality was introduced. Existing capabilities were preserved. Product behavior and approved timing decisions are unchanged.

## Secure runtime access attempt — September 28, 2026 (America/New_York)

CEO accepted the connected database checkpoint and authorized secure test-runtime setup, synthetic identities, and A01–A15 after authentication/ownership checks pass.

The Vercel dashboard briefly showed an authenticated session for the existing project `submission-assistant-85w9`. The visible project-variable list contained four Preview client configuration entries: `REACT_APP_ALLOWED_SUPABASE_PROJECT_REF`, `REACT_APP_SUPABASE_ANON_KEY`, `REACT_APP_SUPABASE_URL`, and `REACT_APP_ENVIRONMENT`. Values were not revealed, so their target project was not inferred. No required server/worker/provider variables were visible in that list.

The Add Environment Variable dialog defaulted to Production. No values were entered or saved. Opening its environment selector left the form disabled. A single refresh returned the browser to login; a fresh tab also showed login. Secure runtime configuration remains blocked by the browser session not persisting. This is not evidence of a product defect or a bot block.

No runtime settings changed, no credentials were created or exposed, no synthetic users/memberships were provisioned, and no test mail or deployment occurred. Connected A01–A15 remain unexecuted. The existing connector does not offer environment-variable writes; dashboard access is required unless a secure scoped CLI configuration is supplied.

## Fresh sign-in and runtime isolation check — September 28, 2026, 22:15 EDT

The new user sign-in succeeded. Dashboard controls responded. Prepared 13 non-secret settings with workflow/email flags off, exact recipient addresses, test database reference, and a dedicated synthetic workspace; selected only Preview branch `codex/revision-5-workflow-foundation` and deselected Production before attempting save.

Vercel rejected the save: `Project "submission-assistant-85w9" does not have a connected Git repository.` No variables were saved. The unsaved form was discarded. A read-only inspection of the other project, `submission-assistant`, also explicitly showed no connected Git repository.

Authentication is no longer the observed blocker. Branch-specific test configuration requires a repository connection or a separately isolated non-production runtime. Broad Preview overrides were not substituted because they could change unrelated previews, including Owner UAT. No repository connection was added because deployment-trigger behavior has not been established. No secret values were entered, no deployment was requested, and no test messages were sent. A01–A15 remain pending.


## Isolated runtime preparation — September 30, 2026

Status: runtime preparation advanced; no connected A01–A15 executed.

- Recovered the committed source in `/workspace/scratch/ef11b0fef41d/welcomeflow`, branch `codex/revision-5-workflow-foundation`, starting head `689ab9d8cca6222af2143b98d85afbaab8c8aa58`. Origin is `https://github.com/ashleysimpson0218-hash/Submission-assistant.git`. Remote branch was absent in read-only checks.
- Verified the existing isolated Vercel project `welcomeflow-revision5-test`, project ID `prj_M1XpY5rahX31QqPdXzv0m4xFGjtL`, team `team_taUwIH8zImWmWOtcqnzM2uqU`. Deployment list is empty. No new project or repository was created.
- Dashboard authentication worked without a new login. Saved 18 non-secret configuration settings to **Preview only in this dedicated project**. The dashboard confirmed success and every setting showed Preview. The Shared tab explicitly showed no linked shared variables.
- Frontend/server environment is `acceptance`; both project-reference guards and Supabase URLs identify `bjverobaoujhfaylyrzi`. Workspace allowlist and frontend workspace are `revision5-connected-synthetic`. Autosave is false. Recruiter role allowlist is `recruiter`.
- Exact recipient allowlist contains only the three previously approved addresses. Domain-wide allowlisting is absent (empty values are rejected by the UI; application code treats absent as an empty list).
- Frontend workflow flag, workflow/email/resume/booking/communication-audit server flags are false; external-actions-disabled flag is true. No secrets/provider credentials/public key/origin have been provisioned. No workflow memberships or Auth users were created. No worker or email was started.
- Found two missing tracked infrastructure prerequisites in the restored Test database: workspace anonymous SELECT was still granted, and the shared API rate-limit table/function were absent. Applied the existing hardening and rate-limit migrations to WelcomeFlow Test only. No workspace rows or production objects changed.
- Real service-role invocation exposed PostgreSQL error 42702 in the existing rate-limit function: `subject_hash` was both a local variable and a column. Added a minimal follow-up migration renaming only the loop variable to `v_subject_hash`. No policy, limit, or product behavior changed.
- Connected verification passed: first request allowed, second over-limit request rejected; test writes rolled back. Anonymous/authenticated workspace SELECT denied; anonymous rate RPC denied; service-role rate RPC allowed. RLS and browser-role denials remain on all workflow tables; service UPDATE/DELETE/TRUNCATE remain denied for command/event tables.
- Security advisor returned only INFO notices for RLS tables with no browser policies, consistent with the intentionally server-only API design. Reference: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- `CI=true npm run build` passed. This is a local build, not a deployment or connected acceptance pass.

### Migration timestamp reconciliation

Do not reapply existing migrations merely because their connector-assigned timestamps differ:

| Repository source | Test remote version |
| --- | --- |
| `20260807035518_harden_default_public_privileges.sql` | `20260930223513` |
| `20260807035519_add_shared_api_rate_limits.sql` | `20260930223519` |
| `20260930223640_fix_rate_limit_variable_ambiguity.sql` | `20260930223702` |

### Deployment blocker and next exact action

Automatic approval review rejected `git push origin HEAD:refs/heads/codex/revision-5-workflow-foundation`, citing private source disclosure to a GitHub destination not explicitly approved for this action. The push was not retried or bypassed. A subsequent read-only remote check still showed no such branch.

Approval needed: publish the reviewed Revision 5 branch and this infrastructure correction/checkpoint to the existing repository `ashleysimpson0218-hash/Submission-assistant`, branch `codex/revision-5-workflow-foundation`, solely to support the isolated test runtime. Do not push main, change production, or connect another project.

After approval, verify the exact remote commit, establish Preview-only deployment in the dedicated project, configure test-only secrets/provider and synthetic identities, verify all runtime/database/membership/role/worker/recipient guards, and execute A01–A15. Do not treat the saved Vercel configuration as a running runtime. A test origin is not yet established. Production and unrelated Vercel projects remained unchanged.
