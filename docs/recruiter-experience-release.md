# Recruiter experience: industry setup and enablement

## Product direction

WelcomeFlow is a recruiter workflow assistant for multiple industries. Recruiters choose an industry during account/workspace setup. Trucking is one profile, alongside healthcare, manufacturing and skilled trades, hospitality and retail, professional and technology, and other/mixed industries.

The shared daily workflow remains candidate intake, exact opening match, screening, submission review, follow-up, interview, offer, onboarding, and reporting. Industry settings adapt role starters and screening prompts rather than fork the product into separate apps.

## This release

- Industry choice in the existing signup preview, authenticated account profile, and unconfigured workspace setup.
- Additive industry profiles: preserve existing candidates, openings, roles, custom communications, workflow timing, and reporting identities. Reapplying a profile does not duplicate role starters.
- Optional per-role industry prompts, including driver route/equipment/home-time and credential details. Candidate-reported answers do not constitute eligibility or compliance approval.
- Saved question labels and answers travel with intake drafts/candidate snapshots and feed the existing candidate-notes field in default manager/ATS communications and the canonical submission preview. Custom templates still control whether that field is displayed.
- Employer-neutral onboarding wording for unchanged built-in templates on explicitly classified non-healthcare roles. Preserve edited templates and approved variants.
- Guided lessons for daily work, intake, communication, leadership reporting, and handoffs; an isolated fictional practice exercise; searchable help.
- Clear saving/link/manual-handoff statuses without claiming unverified external integrations.
- Working mobile navigation for deep candidate pages, larger mobile form controls, and stacked reporting rows.
- Fixed misleading nonclinical credential readiness and completed-setup status.

## Storage and rollout

Industry preferences use the existing workspace settings and authorized persistence path. They are shared workspace settings, not a new independent per-user account system. Role industry IDs are included in role spreadsheet exports/imports; a full JSON backup remains the complete workspace backup.

Training completion is session-only and explicitly labeled. The practice exercise changes only its component state. No new database migrations, APIs, paid services, automatic messages, or ATS integration are introduced.

Keep this change in review/preview. Existing production maintenance and authentication gates remain in place. New production registration, multi-recruiter membership, and per-user training persistence are not implemented by this change.

## Acceptance checks

1. Choose an industry in account setup; verify the selection and added role starters. Try another industry and confirm existing records remain intact.
2. Configure a role and opening; answer industry prompts; save/reopen the draft; review the default manager and ATS notes. Switching to a different role must not leak prior-role answers.
3. Review custom and approved templates to confirm no automatic replacement. Verify inactive/ambiguous role matches do not select alternate industry wording.
4. Review a lesson, use a working-page link, and complete the fictional practice exercise. No candidate record or message should be created.
5. At phone and desktop sizes, verify navigation, intake controls, reporting selections/actions, help search, and connection-status wording.

## Work remaining for launch

- Finish secure production account registration, workspace membership, and recruiter permissions; then verify industry onboarding through that actual registration path.
- Complete browser acceptance on a reachable preview, including phone layouts and signed-in navigation.
- Decide the first real external connector and complete its authorization/delivery testing. Paycom remains manual copy/paste.
- Extend terminology across legacy reports and editors and add employer-reviewed industry configurations. Starter profiles are not exhaustive industry compliance packages.
- Add per-recruiter training progress and support escalation through the approved account model.
- Establish measured baselines for intake time, administrative time, follow-up completion, report-preparation time, and time spent sourcing. Do not advertise time savings before measuring them.
