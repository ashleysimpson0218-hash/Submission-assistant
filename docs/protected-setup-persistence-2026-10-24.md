# Protected setup persistence — first implementation component

Date: October 24, 2026. Parent: `13a6c66dd32e669f0948e65d0fe6fde6c94e5d46`.
Status: **new API and transport implemented and locally unit-tested; SQL staged but not executed; not wired into the existing screens; complete persistence repair still open.**

## What this change does

This is an additive first component of the approved protected-workspace repair, not a replacement of the whole application. The existing general autosave sends a broad workspace object and preserves selected communication drafts. That path cannot safely be replaced by an unrestricted server overwrite. This component handles only the existing recruiter/company basics in `settings.general`:

`companyName`, `recruiterName`, `recruiterEmail`, `signOffLine`, `includeSignatureLineInEmails`.

These are shared workspace defaults in the existing model, not authenticated identity attributes or a new per-user profile. Current allowed recruiters and admins may read/edit them through the new contract; managers, interviewers, candidates, HR and leadership are not authorized by this endpoint. Editing the default email does not establish a verified sending identity or enable communications. Field-level and record-level policies for other data still require separate implementation.

Added files:

- `api/workspace-setup.js`: route using the existing security helper.
- `server/workspaceSetupAccess.js`: runtime, role, payload, response and error controls.
- `src/workspaceSetupClient.js`: transport and exact-edit acknowledgement helpers; not imported by App.js yet.
- `supabase/migrations/20261024000100_protected_workspace_setup.sql`: staged service-only transactional function.
- `test/workspace-setup-access.test.cjs` and `test/workspace-setup-client.test.cjs`: local tests.
- `test/workspace-setup-database.sql`: guarded disposable-database acceptance script, **not run**.
- This checkpoint.

## Server and database contract

The API is disabled by default. It requires `WELCOMEFLOW_ENABLE_WORKSPACE_SETUP_ACTIONS` to be exactly `true`, safe existing runtime/project configuration, and environment `test` or `preview` bound to the approved synthetic Test project. It rejects production, Owner UAT, acceptance mode and other projects. No configuration was enabled during implementation.

The route reuses verified identity and current membership through `authorizedRecruiter`, then applies an additional admin/recruiter role restriction. Existing configured workspace/role restrictions remain in force. Requests are bounded, rate-limited before and after authorization, and restricted to GET/POST. POST accepts only an expected workspace timestamp and an allowlisted field patch. Browser-supplied actor, role, table, arbitrary JSON paths and whole-workspace payloads are not accepted.

The staged SQL function is `SECURITY INVOKER` with an empty search path and execution revoked from PUBLIC/anon/authenticated. Only the service role is granted execute. It independently rechecks the exact active workspace membership and role inside the transaction, locks membership before workspace, compares the supplied timestamp, and merges only allowed fields into the latest stored settings. Candidate data, templates and unrelated settings are preserved. It neither creates workspaces nor provisions accounts.

Row locks are intended to serialize writes and membership changes. An operation that obtains the permitted membership lock before removal may complete before that removal; the design does not promise to undo an already-authorized request. Concurrency and SQL behavior have not yet been executed against PostgreSQL.

The function returns only the selected basic fields and their workspace timestamp. The HTTP layer rejects mismatched workspace/field acknowledgements and omits arbitrary extra database data. Errors do not expose raw database details. No browser table grants, RLS policies, provider calls, credential exports, or existing migration rewrites are introduced.

## Browser transport contract

The adapter gets a current access token for each request and uses only the fixed same-origin `/api/workspace-setup` endpoint, with no cache and redirects rejected. It does not fall back to local storage, direct database calls, or automatic retries. An unavailable response is an unconfirmed outcome, not proof that the server did or did not commit.

Each save captures its submitted fields and local edit revision. The integration must use `acknowledgesCurrentSetupEdit` against the current workspace and latest edit revision before displaying Saved. A completed older save must not mark newer typing as saved. On logout/user/workspace change, call `dispose()` and clear form state; the adapter then suppresses pending responses. Disposal cannot reverse a server operation that already committed.

## Verification actually performed

On Node v22.16.0:

```sh
node --test test/workspace-setup-access.test.cjs test/workspace-setup-client.test.cjs
node --check api/workspace-setup.js
node --check server/workspaceSetupAccess.js
node --check src/workspaceSetupClient.js
```

**70 local checks passed, 0 failed, 0 skipped.** This comprises 49 server/contract checks and 21 client checks. Authentication, rate-limit, database and HTTP responses are injected test doubles. One of the 49 is explicitly a static SQL contract check. These checks establish behavior of the new JavaScript for the supplied responses; they are not proof that real Supabase authentication, database locking, role isolation or durable writes work. An initial test-file syntax error was corrected before the passing run.

The current package.json was retrieved and preserved for the build attempt. `CI=true npm run build` stopped with `react-scripts: not found` (exit 127). This container does not have the complete checkout/dependency installation and direct repository download failed DNS resolution. No successful React build, full existing regression suite, browser test, PostgreSQL compilation, connected SQL test, persistence/reload test, or security certification is claimed. No dependencies were changed or installed.

The disposable SQL acceptance script refuses execution without explicit confirmation, the expected database name and a `welcomeflow.disposable_test=true` session marker. It is intended to check normal read/save/reload, field preservation, stale writes, company separation, roles, removal/demotion, and direct function privileges after deployment to an explicitly authorized disposable schema. Its fixtures roll back. This script has **not run**, and it does not test concurrent sessions or end-user HTTP authentication.

## Why the original form is not switched yet

App.js, the original setup form, Owner UAT, demo behavior, existing cloud save helpers and current database settings are unchanged. The existing source also saves communication drafts and activations through direct browser operations. Those callers and broader candidate/requisition mutations are not yet migrated. Enabling this small endpoint must not be represented as repairing the complete workspace.

The next integration must prevent the old broad autosave from overwriting these fields later. Inventory and migrate the applicable writers, or block the incompatible old writer in the authorized mode; do not simply turn on both. Main-app real sign-in, workspace resolution and session/cache clearing remain open. Reuse the existing setup guide and authenticated components instead of creating a parallel setup form or second data store.

## Remaining work and acceptance gate

1. Validate the new function in an authorized disposable database, including two-session stale-write and membership-revocation tests. Confirm actual grants and lock order against other writers.
2. Complete real main-app sign-in and connect the existing basic setup form to this adapter with explicit account/workspace context and accurate pending/saved/conflict states.
3. Resolve general autosave, draft/activation and other direct-writer coexistence. Keep candidate and permission mutation boundaries separate; no unrestricted whole-workspace overwrite endpoint.
4. Run the full application build and regression suite in a complete checkout. Then verify close/reopen, interrupted setup, sign-out, cross-company access and stale responses using fictional accounts.
5. Continue the broader security review and remaining setup/duplicate-work cleanup. Snapshot-to-Go, Lean Six Sigma measurement and the extension remain on the agreed roadmap; no duplicate queue or direct Paycom integration is introduced.

No merge, deployment, database execution/settings change, customer pilot, real candidate use, email or calendar write occurred in this implementation step. The existing review-branch deployment guard is retained.

## Source and design references

Source inspected at the parent commit: AGENTS.md; App.js imports and persistence entry; communicationDraftCloudSave.js; runtimeConfig.js; welcomeflowApiSecurity.js; package.json; and the full repository tree. Prior recorded workflow/store and foundation schema were used as architectural context, not as new connected test evidence.

Official platform references, checked October 24, for design behavior only:
- Supabase session trust: https://supabase.com/docs/reference/javascript/auth-getsession
- Supabase database-function execution security: https://supabase.com/docs/guides/database/functions
- PostgreSQL 17 row locks: https://www.postgresql.org/docs/17/explicit-locking.html

These references do not verify WelcomeFlow's implementation. The SQL concurrency guarantees remain pending actual database tests.
