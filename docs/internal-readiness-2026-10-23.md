# Internal readiness: first security and setup repairs

October 23, 2026. Status: **first repairs verified locally; overall internal readiness remains incomplete**.

Follow-up: the [setup simplification checkpoint](setup-simplification-2026-10-23.md) records the subsequent shared setup guide, direct editor navigation, wording changes, and current verification. The results below describe the original repair checkpoint.

This work follows the owner's instruction to repair security, setup, and usability before any customer testing. It is based on the exact `codex/manager-email-actions` source at commit `0f764be49419eeed17e5dc1462bfbcf562f2b182` (tree `1fe8cc6905c4b8a89de5200110d2f6e599297e33`). The review branch is `codex/internal-readiness-access-setup-20261023`.

## Implemented in this package

### Current membership for recruiter actions

The email, resume-parser, and communication-audit APIs share `authorizedRecruiter()` in [`server/welcomeflowApiSecurity.js`](../server/welcomeflowApiSecurity.js). That helper previously used Supabase Auth application metadata for workspace membership and role, while the workflow API used the current workflow membership table.

The helper now verifies the authentication token with `auth.getUser()`, then reads the exact `(workspace_id, user_id)` row from `welcomeflow_workflow_members` using the trusted server client. The row must be active, match both identifiers, and have a role permitted by the existing server configuration. The existing configured workspace restriction, runtime/project binding, action flags, recipient restrictions, and rate limits remain in effect.

There is no metadata fallback. Removed, inactive, mismatched, or disallowed-role memberships are denied. Missing server access, database failures, thrown requests, and ambiguous/malformed results prevent authorization. Database details are not returned to the caller.

**Compatibility requirement:** accounts previously provisioned only through `app_metadata` now need a correctly provisioned active workflow membership row before these APIs can be used. An absent row results in a forbidden response; an unavailable membership table results in an unavailable response. No accounts or memberships were provisioned in this package. [`.env.example`](../.env.example) documents the new authority and retains both existing allowlists.

The guarantee is limited to the next request after membership revocation. An external action that was already authorized and is in flight may finish. These three APIs use workspace-level recruiter authorization; this patch does not add every workflow engine per-requisition permission check to legacy operations or establish security of every other storage and session path.

### Readable, actionable opening checks

The setup issue producer and renderer now use matching message and navigation fields. Each warning identifies the opening and missing field. Whitespace-only numbers, job titles, and locations count as missing. A workspace with no active openings receives an explicit warning.

The repair action uses the existing exact-record navigation and opening editor. It targets the affected field without silently saving or overwriting an opening. A missing or ambiguous record is handled by the existing navigation resolver rather than selecting a different opening. All issues can be expanded when there are more than three.

The status is now **Check opening details**, with a narrow statement about the fields actually checked. Passing these checks does not claim that account access, communication settings, security, or the entire workspace is ready.

Implementation and rendered regression evidence are in [`src/App.js`](../src/App.js) and [`src/workspaceSetup.test.js`](../src/workspaceSetup.test.js). Existing candidate, reporting, and requisition data models are preserved.

### Review branch deployment guard

[`vercel.json`](../vercel.json) disables automatic Git deployments for this exact review branch only. It does not change deployment behavior for other branches, action flags, worker origins, schedules, or environment variables. The branch must first be created at the commit containing this guard; it must not first point to the unguarded baseline.

This uses Vercel's documented [`git.deploymentEnabled`](https://vercel.com/docs/project-configuration/git-configuration#gitdeploymentenabled) configuration. No release, migration, worker activation, or real communication is part of this package.

## Verification

The stable implementation passed the following checks under Node `v24.19.0`. Tests use fictional data and mocked services; they do not establish connected database policy or deployed behavior.

| Check | Result |
| --- | --- |
| Jest regression run with explicit `TZ=America/New_York`, excluding the runner-blocked source-privacy invocation | **88 suites / 1,091 tests passed**, including all new authorization and setup cases |
| Existing Node workflow, calendar, and scheduler tests with `--test-isolation=none` | **59 named cases passed**, zero skipped or cancelled |
| Equivalent source-privacy scan using the checked-in rules and a Git file manifest obtained from the shell | **201 tracked and newly added text files checked; zero findings** |
| `CI=true npm run build` | **Passed; compiled successfully** |
| `git diff --check` | **Passed** |
| Independent review of access control, setup navigation/tests, configuration instructions, and branch guard | **No blocking defect identified** |

Commands for the broad regression and build:

```sh
TZ=America/New_York CI=true npm test -- --watchAll=false --runInBand --silent --testPathIgnorePatterns=src/sourcePrivacyScan.test.js
node --test --test-isolation=none --test-reporter=tap test/*.test.cjs
CI=true npm run build
git diff --check
```

Verification qualifications:

- The initial unqualified Jest run produced five calendar assertion failures because those existing tests assume New York or UTC while the runner defaulted to America/Chicago. Both calendar suites passed all 17 cases when the time zone was explicit, and they passed in the broad rerun above. No calendar code or expectations were changed.
- `sourcePrivacyScan.test.js` could not launch its nested `git ls-files` process (`EPERM`). Its identity and reserved-email-domain rules were run separately against an allowed-shell Git manifest, including the newly added files. The original Jest invocation remains environment-blocked; the separate scan is not represented as a passing Jest test.
- Default Node test isolation reported only four file wrappers in this environment. The no-isolation run executed and reported the 59 individual named assertions. Wrapper counts are not used as test evidence.
- The build emitted existing dependency/deprecation and stale Browserslist-data notices, without a compilation error. Dependencies were not changed.

## Remaining internal readiness work, in order

| Work | Required outcome |
| --- | --- |
| Complete the access review | Trace authentication, offboarding, company separation, role and opening permissions across all read/write paths, including the main workspace storage path and signed links. Verify actual environment configuration and database policies in the appropriate isolated environment. |
| Complete the security foundation | Verify transport and stored-data protection, server secrets, retention/deletion, backup restoration, logging, and operational recovery. Record evidence and unresolved issues rather than assuming provider defaults prove the product is secure. |
| Revamp guided setup | Establish one authoritative setup path; distinguish required fields from optional customization; route directly to current editors; use accurate saved/failed status; make progress reflect the actual requirements. Consolidate the overlapping eight-section settings wizard and five-step Learn & Setup flow. |
| Simplify screens and language | Present the next useful action clearly, reduce duplicate navigation and jargon, and check small-screen use while preserving approved workflows and styling. |
| Complete internal verification | Exercise fresh setup, corrections, permission changes, persistence/reload, recovery, and representative workload with fictional records. Match the tested source and artifact to any later authorized test deployment. |
| Evaluate installation options | Compare the responsive web experience, an installable web app, and app-store distribution after the core readiness work; no native app is included here. |

Customer pilots and Paycom integration remain outside this phase. Copy/paste-ready ATS notes remain the existing integration boundary.

## Evidence and interpretation

- The security regression tests exercise removed/inactive/demoted members retaining a valid login, correct current members without metadata, company/user mismatches, allowlists, unavailable membership verification, and denial before downstream actions in all three affected endpoints.
- Setup tests must exercise displayed messages and navigation into the existing editor, not merely compare literal strings or a helper's output to itself.
- Historical October 17 assessment results are not reused as passes for this commit. Current local results belong below; connected and deployed checks require their own evidence.
- Supabase documents why authorization metadata and JWT state can remain stale in its [row-level security guide](https://supabase.com/docs/guides/database/postgres/row-level-security) and [session guide](https://supabase.com/docs/guides/auth/sessions). Current membership is queried here on each protected request.
