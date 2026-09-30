# WelcomeFlow Revision 5: implementation validation checkpoint

Prepared for Ashley Martin-Simpson, CEO. September 27, 2026.

**Governing authority:** Revision 5 was approved in the CEO implementation authorization in this conversation. CEO-01 through CEO-03 remain closed; CEO-04 remains approved with revision. The preserved specification in `product-standard-revision-5.md` is the original submitted document. Its historical “awaiting approval” language is superseded by that explicit authorization and the timing decisions below. No production release is authorized.

## Scope of this checkpoint

An additive implementation of the Section 6 prerequisite foundation and first interview workflow. Existing intake, reviewed submission packets, requisition IDs, main navigation, reports, historical records, and industry configuration are retained. The new workflow uses the same candidate/requisition identities. The existing Work page receives an opt-in Interview work section; `/workflow` is a scoped website action page, not a browser extension.

Implemented:

- Server-checked memberships and active requisition ownership; narrow assigned-stage access for decision owners and supporting interviewers. Candidate links are signed, expiring, and bound to workspace, candidate, stage, and purpose.
- Shared state, stable command receipts, immutable event grants, optimistic concurrency, and atomic state/event commits. Database permissions reject direct anonymous and browser-authenticated table access. Current membership and source-workspace version are rechecked during commit.
- Reviewed post-screen handoff; Proceed, Hold, and required-reason Decline; distinct confirmed withdrawal; one or multiple required stages; supplied interview slots and candidate selection; confirmed completion, supporting feedback, and stage-owner decisions. Final favorable completion means ready for offer handoff, not hired or offer terms approved.
- Recipient-local communication windows, adjustable working days and timing, one escalation owner, consolidated requisition follow-ups, contextual manager reminders, and candidate experience check-ins. A positive check-in creates no task; actionable responses create an owned exception without inferring withdrawal.
- Durable outgoing work with separate queued, sending, provider-accepted, delivered, failed, unknown, and manually confirmed states. Unknown sends need evidence before replay. Explicit throttling has bounded retries. Provider delivery failures create recovery work. A missing worker heartbeat is visible.
- Evidence-based recovery, corrected contact permission, replacement candidate links, replacement offered times, and ownership recovery for supported decision states. Audit history records actor, timestamp, and reason. Copying or opening an existing onboarding message no longer completes that step.
- Brief in-context instructions for decisions and recovery. This is not the later full training/progress system.

## Changes from the approved specification

Only the two September 27 CEO timing resolutions change the previously unresolved behavior:

| Situation | Implemented communication path |
| --- | --- |
| More than 48 hours before interview | Immediate booking confirmation; preparation due 48 hours before; reminder due 24 hours before. |
| 24–48 hours, including exactly 48 hours | Immediate confirmation; preparation due at booking under the normal window; a future 24-hour reminder when applicable. |
| Exactly 24 hours | Confirmation and preparation, combined when both can send. No additional already-due 24-hour reminder. |
| Less than 24 hours | Immediate confirmation includes preparation. No manufactured late 24-hour reminder or separate preparation message. |
| Booking outside 7:00 AM–6:30 PM or configured window | The immediate booking confirmation is the only transactional exception. Other messages wait for the permitted window. |
| Several candidate interview messages become due together | One email carries the applicable content and records each individual job, preventing back-to-back duplicates after a closed window or outage. Expired interview messages are suppressed. |

The reservation is committed before immediate confirmation delivery is attempted. Delivery failure preserves the reservation and outgoing task. The selected communication path, policy version, stage, lead time, individual communication jobs, and actual batch membership are audited. Joining details and preparation text are supplied by the stage owner; the system does not invent them.

Other changes are implementation details within the approved scope: server permissions, transaction boundaries, evidence states, tests, scoped website controls, and setup values. No settled CEO decision is reopened.

## Validation evidence

Final results are recorded below after the validation run. The browser checks use the real compiled React interface with synthetic API responses and block external requests. They do not establish live Supabase or email-provider connectivity.

- Domain/communication acceptance: **21 tests passed**.
- SQL acceptance: **passed** in isolated PGlite/PostgreSQL-compatible execution. Includes atomic rollback after a forged event, duplicate commands, conflicting revisions, changed source version, revoked membership, private RLS tables, and immutable event grants.
- Browser: **passed** for desktop and 390-pixel mobile manager actions, supplied-slot form, candidate booking, candidate experience submission, root route, and absence of page errors/horizontal overflow.
- Regression suite: **1,030 tests passed across 84 suites** (`TZ=UTC`).
- Production build: **passed**, including the configured lint gate.
- `git diff --check`: **passed**.
- **Remaining failures in the executed local checks: none.** Connected non-production validation remains unexecuted and is listed below.

Previous failures resolved: the UI test session mock was reset by the runner; the Owner UAT entry-point test assumed the previous single import; existing date tests required an explicit supported test timezone. The complete regression run uses `TZ=UTC`. Browser verification now launches the server and browser in the same isolated process environment. It uses a temporary test-only Chromium installation; application dependencies are unchanged.

## Exact CEO acceptance scenarios

These are ready for review against the local implementation and test evidence. A connected, authenticated non-production pilot remains a separate validation gate before release.

| ID | Action to review | Required result |
| --- | --- | --- |
| A01 | Recruiter hands off a reviewed candidate on an existing active requisition. Repeat the same request. | One case and one initial request; no duplicate candidate or transition. |
| A02 | Unrelated manager opens the action page; owner opens it; close the requisition. | Unrelated manager has no access. Owner sees permitted related work. Closed requisition is removed from manager scope. |
| A03 | Complete a one-stage CNA or driver plan. | Human Proceed, manager-supplied slots, candidate booking, human-confirmed completion, feedback, and final human decision. No offer-ready state before final completion. |
| A04 | Complete an executive plan: VP interview, second leader, executive/panel. | Each Proceed advances exactly one configured stage. Supporting panel feedback cannot make the stage decision. |
| A05 | Hold, then later Proceed; try Decline without a reason. | One active-review message without a promised date. Hold preserves the stage. Decline requires a short reason; comment is optional. |
| A06 | Candidate explicitly withdraws. | Distinct withdrawal outcome; obsolete queued work stops. Candidate “no longer interested” check-in alone is not treated as confirmed withdrawal. |
| A07 | Book at 8:00 PM recipient-local time with an interview 36 hours away. | Reservation saves; confirmation is attempted immediately. Preparation waits for the permitted window; the 24-hour reminder remains subject to timing/window rules. |
| A08 | Book with 72, 48, 36, exactly 24, and 12 hours remaining. | Correct audited path for each boundary. Under 24 hours includes preparation in confirmation. No late or duplicate reminder is manufactured. |
| A09 | Let preparation/reminder deadlines accumulate while the window is closed. | Due, still-relevant candidate messages consolidate into one email; individual job outcomes remain recorded. |
| A10 | Confirm an interview occurred; submit positive feedback, then test an actionable negative response on another case. | Check-in is due after the configured delay. Positive response creates no task. Negative feedback/questions/follow-up create one owned recruiter exception, not a hiring decision. |
| A11 | Multiple candidates on one requisition need the same manager’s feedback. | One consolidated communication, separate candidate decisions and clocks. Context stays within the recipient’s authorized scope. |
| A12 | Simulate email acceptance followed by a lost result, or a provider bounce. | Uncertain result is not automatically resent. Evidence-based recovery is available. Bounce creates owned attention. Provider acceptance never means delivered or a manager decision. |
| A13 | Submit a stale decision or overlapping interview booking. | Conflict is rejected, current work retained, refresh requested. Required stages are not skipped. |
| A14 | Copy or open an existing communication draft. | Preparation is recorded; the workflow step is not falsely completed. |
| A15 | Use manager and candidate forms on a narrow mobile screen. | Controls remain usable without horizontal scrolling; responses receive a recorded-success acknowledgement. |

## Remaining validation and release gates

No production migration, deployment, membership provisioning, worker activation, or real candidate email has occurred. Feature flags remain off by default.

Before a connected pilot: apply the additive migration to an explicitly approved non-production database; provision actual test memberships; verify the protected API, scoped identity checks, provider acceptance/delivery recovery, and supervised worker with allowlisted test recipients. Exercise concurrent requests against that database. Local database and browser tests are evidence for the change set, not a substitute for those connected checks.

The first checkpoint stops at readiness for configured offer handoff. Section 6 later work such as expanded outreach/offer/start loops, leadership span roll-ups, retention/archive administration, and full persisted training remains future sequence work. Direct calendar/self-service enhancement, candidate-proposed alternatives, extensions, ATS/Paycom integration, credentialing, and detailed onboarding remain deferred or out of scope.

The additive store serializes commits per workspace. Load testing and archive handling are required before a large live rollout. Existing reports are preserved; the new interview view derives its own workflow counts. Full cross-surface reporting reconciliation belongs to the later approved reporting phase.

## Operator notes, not activation instructions

The new frontend gate is `REACT_APP_WELCOMEFLOW_WORKFLOW_ENABLED`; the protected API gate is `WELCOMEFLOW_ENABLE_WORKFLOW_ACTIONS`. Existing runtime/project/workspace allowlists and email safety flags continue to apply. The worker requires `WELCOMEFLOW_WORKFLOW_WORKER_SECRET`, `WELCOMEFLOW_PUBLIC_ORIGIN`, the existing Resend configuration, approved recipients/domains, and `WELCOMEFLOW_CANDIDATE_LINK_SECRET`. Both secrets must be at least 32 characters and remain server-side.

`run-workflow-worker.cjs` is an explicitly started supervised runner, with `--once` for an approved test run. It is not installed or activated by this change. Immediate booking delivery calls the same protected worker after commit. Regular processing must be supervised so reminder timing, failure reconciliation, and heartbeat monitoring continue.

Validation scripts: `test/workflow-foundation.test.cjs`, `scripts/verify-workflow-sql.cjs`, and `scripts/verify-workflow-browser.cjs`. SQL/browser dependencies can be supplied from a temporary validation environment; no runtime dependency was added to the product.
