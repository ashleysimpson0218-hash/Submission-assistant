# Internal readiness: recovered migration history saved to source

Date: October 24, 2026. Parent baseline: `ce174f61b4dc4744af64f846862a3fbed6c4a1fb`.

## Scope and authorization

The owner approved continuing the bounded repair package after reviewing the baseline proposal. This change restores the two recovered historical SQL definitions to draft PR #17. It does not change application JavaScript, merge or deploy, execute SQL, reset an environment, or alter any current database permission. The exact-branch deployment guard is unchanged.

## Files restored

- `supabase/migrations/20261017195452_add_hr_workflow_role.sql`
- `supabase/migrations/20261018033142_enforce_workflow_tenant_boundaries.sql`

Both files preserve the exact recorded text from WelcomeFlow Test migration history, including the original version and name. No comments, whitespace fixes, or rewritten SQL were inserted into historical definitions. Checksums and source serialization are recorded in `recovered-migration-provenance.json`.

A fresh SELECT-only check of the two migration-history entries returned the same names, one statement-array item per version, character lengths of 322 and 2519, and the same MD5 equality checks as the recovered evidence. Local SHA-256 checks match the preserved evidence package. This verifies text preservation; it does not establish SQL correctness or complete database equivalence.

## Verification performed

Command: `node --test test/recovered-migration-integrity.test.cjs`.

Result: **3 tests passed, 0 failed**, under Node v22.16.0. The tests verify the exact bytes of both recovered definitions and one filename per recovered version. They run without a database or external services. The inspected base migration directory contained neither version before these additions.

A production build was attempted using the fetched package manifest. It stopped with `react-scripts: not found` (exit 127). This runtime has no complete checkout/dependency installation, and direct repository retrieval was unavailable. No successful application build or full regression pass is claimed. The partial local workspace is sufficient for these standalone integrity tests only. Existing files are preserved through a Git tree based on the exact parent tree, rather than copied from a partial checkout.

No connected SQL replay, security behavior test, browser session, sign-in, save/reload, application test suite, or visual check was performed. Previous test totals do not apply as new evidence to this revision.

## Historical details deliberately left unchanged

The tenant-boundary definition checks foreign-key names and can create a second equivalent workflow-state workspace foreign key. That behavior is preserved because this is already-applied history. Any cleanup belongs in a separately reviewed later migration after checking dependencies; never edit the old definition to silently rewrite history.

Restoring these two files does not prove that every older migration version, function, policy, and environment is synchronized. Compare the complete history before a later database deployment. Do not run a reset, blanket push, migration-history repair, or replay against the existing Test or production database as a consequence of this source-only commit.

## Next bounded repair: protected workspace persistence

The baseline review identified a browser-direct load/save path that does not match the inspected restrictive test grants. That path is **not repaired by this migration-history commit**.

Continue the approved work by inventorying direct callers, including general autosave, template draft saves/activation, intake and workflow operations. Reuse verified identity and current workspace membership. Define role/field-level mutation boundaries before exposing a server save endpoint; do not add an unrestricted whole-workspace JSON overwrite or broaden browser grants. Acknowledge the exact saved revision and reject stale writes without erasing newer information. Preserve Owner UAT, explicitly isolated demo behavior, existing setup navigation, reviewed packets, and candidate/requisition identities.

Internal verification must cover authorized success as well as wrong-company, removed/demoted user, stale revision, failed save, and close/reopen cases with fictional records. Keep provider sends and calendar writes disabled. Main-app authentication, protected persistence, broad security review, and customer readiness remain incomplete.

Direct Paycom integration, automatic ATS writes, new customer pilots, store publication, and production release remain outside this package.
