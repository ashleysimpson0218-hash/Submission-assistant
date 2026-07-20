# WelcomeFlow Test MVP v1 Release Baseline

This document freezes the approved, test-only WelcomeFlow communication MVP at the completion of Phase 2E. It is a historical acceptance baseline, not approval for production use or restoration of candidate data.

## 1. Approved Baseline

- Commit: `a65f69ab7769c32cf22b555c1ce1f68ee46aa7bc`
- Tag: `welcomeflow-test-mvp-communication-complete-v1`

## 2. Environments

- WelcomeFlow Test Supabase project: `bjverobaoujhfaylyrzi`
- Production Supabase project: `qfpgednixvveelgwfylv`
- Production status: Maintenance-only and locked

Production is prohibited as a test-runtime target. This baseline does not authorize production access, deployment, or data restoration.

## 3. Test Workspace State

The accepted Phase 2E test snapshot contained:

- Tracker records: 1 synthetic test record
- History events: 5
- Communication action events: 8
- Generated outputs: 0
- Active communication records: 10

Read-only verification on 2026-07-19 found that the live test workspace no longer contained the accepted synthetic tracker, history, or communication-action records. The ten active communication records and all template hashes remained unchanged. The accepted record was not recreated because Phase 3A prohibits test-workspace writes.

## 4. Final Workflow State

The accepted Phase 2E workflow ended with:

- Candidate status: Submitted
- Pipeline Stage: Submit
- Next Action: Awaiting facility feedback
- Waiting On: Facility
- Facility Submission: Sent
- Candidate Confirmation: Sent
- Candidate Follow-Up Text: Sent
- ATS Submission Update: Completed

## 5. Reviewed Package Fingerprint

Accepted Phase 2E reviewed-package fingerprint:

`32d06e022c76815b309b3f059e85dce3`

## 6. Root-Only Template Hashes

- Hiring Manager: `22bb570dd74f5c9f4aea7ce7ce233fa7`
- Candidate Confirmation: `f5776af5b1b53244b491168b25bec238`
- ATS: `6a3ac3ea65977804a63babc992c2f426`
- Original Text Templates: `cc06e33a9ec85bbc7e07c1cddc7e6932`

## 7. Full Container Hashes Including Active Variants

- Hiring Manager: `d2bc02064591e8472de6a1a3a20ece1b`
- Candidate Confirmation: `c9fcae458a7c3c3cdd88079937bbe7e7`
- ATS: `9cab923a384ef7c18d338d61f0d25770`

## 8. Test-Only Feature Flags

The completed workflow's exact code-level feature-flag contract is:

- `communicationReadinessAudit`
- `requisitionCommunicationDetails`
- `communicationPreviewFlow`
- `reviewedCandidateReadyConfirmation`
- `reviewedSubmissionCommunicationActions`

Read-only inspection on 2026-07-19 found only `communicationReadinessAudit: true` in the persisted test `featureFlags` object. The approved code directly reads `communicationPreviewFlow`, `reviewedCandidateReadyConfirmation`, and `reviewedSubmissionCommunicationActions`; these must be enabled in test for their guarded interfaces to be available. The current approved code does not perform a feature-flag lookup named `requisitionCommunicationDetails`; that capability is protected by the test-runtime/project guard instead.

No additional template-draft or template-activation feature-flag names exist in the approved code. Draft saving and activation are controlled by the test-runtime/project guard, explicit review confirmations, validation, and the template record's explicit `Draft`, `Needs Review`, `Active`, or `Inactive` status. Missing variant status never means Active.

## 9. Completed MVP Capabilities

- Communication Readiness grouped by facility and requisition
- Existing-requisition Communication Details
- Benefits eligibility independent from employment type
- Weekly Hours and Contract Duration
- External, Internal, and Rehire communication routing
- Exact facility recipient resolution
- Side-effect-free Submission Package Preview
- Candidate-type confirmation
- Stale-preview detection
- Active candidate-type communication variants
- Reviewed Candidate Ready confirmation
- Exact reviewed-package storage
- Candidate matching and idempotency
- Facility-first communication release sequence
- Candidate email, text, and ATS completion tracking
- Exact saved-content enforcement
- Stale-package blocking
- Legacy-action blocking for reviewed packages
- Communication action timestamps and history
- Awaiting-facility-feedback final workflow state

## 10. Known Launch Blockers

- Real authentication is not implemented.
- Recruiter user accounts are not implemented.
- Role-based permissions are not implemented.
- Production workspace membership RLS is not implemented.
- Production remains maintenance-only.
- Production real candidate data remains locked.
- Email, booking, resume, SMS, and ATS APIs remain disabled.
- PDF dependency vulnerabilities require remediation.
- Git history contains a historical production anonymous Supabase JWT in older `src/App.js` revisions; rotation status must be confirmed and history exposure remediated or explicitly risk-accepted before launch.
- The tracked `src/App_backup.js` file must be reviewed and removed in a separately approved cleanup because Phase 3A permits documentation changes only.
- Server-side communication authorization is not implemented.
- `main` is an outdated application baseline.
- Draft PR #1 must not be merged as-is.
- Real candidate data must not be restored until secure authentication and authorization are complete.

Draft PR #1 must remain open, Draft, and unmerged. Its combined runtime recovery, mock authentication, shared Supabase access, unauthenticated APIs, automatic workspace writes, and vulnerable dependencies require reconstruction or focused review before any merge decision.
