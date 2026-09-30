# WelcomeFlow: Product Standard, Build Audit, and Final Specification for CEO Approval

Prepared for Ashley Martin-Simpson, CEO

Audit date: September 22, 2026. Specification revised: September 24, 2026.

Status: Final specification revision 5, submitted for CEO approval. CEO-01 through CEO-03 remain closed. CEO-04 is APPROVED WITH REVISION: the first workflow includes configurable multi-stage interviews through feedback and final hiring decision. Revision 5 incorporates the post-interview candidate check-in, contextual and consolidated manager communication, and the future recruiter-extension intake concept without changing the approved implementation sequence. Final specification approval remains a separate gate; coding and deployment are paused. The earlier source audit and returned-need rule A are preserved. This document revision establishes no new implementation or test result.

## 1. Executive finding

**North Star: Human judgment stays human. WelcomeFlow handles motion.**

**Product boundary: WelcomeFlow retains the recruiting workflow, not the applicant database.** It manages communication, accountability, handoffs, reminders, and reporting around the client’s recruiting process. Long-term resumes, applications, attachments, credentials, and full candidate history belong in the client’s ATS or other designated system of record. This specification does not authorize changing or deleting current records.

WelcomeFlow already contains a substantial recruiter workflow foundation. Preserve its intake, candidate and requisition identities, reviewed communication packages, Work page, calendar, reporting model, configuration, and safety controls.

The principal gap is that much of the system identifies work and prepares messages, while recruiters still perform the routine motion: open drafts, copy text, confirm sending, complete attempts, reconcile status, and prepare reports. Some screens describe automation that the inspected repository does not substantiate with a durable background execution path.

The next product standard should make approved routine work advance automatically, preserve human authority over decisions, and make every uncertainty or execution failure visible to an accountable owner. Expand the existing build incrementally. No rewrite is proposed.

## 2. What was inspected and what this audit establishes

- Main branch: `98933684272635f1432b367fa6c7bedabc5c3a72`.
- Open, unmerged draft PR #15: `00c52abdd87cda481a6ec70165e1df98c48e044f`.
- Inspected local source tree matches the previously tested draft tree: `97ec21ea594316bd7b87eb02578bf8e94d22784c`.
- Reviewed React workflow and configuration code, API handlers, server authorization, database migration files, communication audit, booking controls, calendar, reporting, and the industry/training draft.
- This is a source audit, not a claim that all code is deployed, all database migrations are installed, or external connections work. Live candidate records and production configuration were not inspected.
- The earlier draft verification reported 1,020 tests passing, plus build and lint. Those checks were not rerun for this document and do not establish compliance with the newly agreed product standard.
- No application code, settings, data, permissions, migrations, or deployments were changed in this audit. The repository remains clean.

## 3. Locked product decisions

These are user-directed standards, including returned-need rule A, closed CEO-01 through CEO-03, and CEO-04 approved with the multi-stage interview revision. Do not reopen settled decisions unless a genuine contradiction or product risk is identified. The remaining approval is for this final specification before coding.

| Decision | Product rule |
|---|---|
| Human judgment | People decide candidate suitability, exceptions, hiring decisions, and offer terms within their authority. |
| Automatic motion | Once the required judgment and permissions exist, routine routing, reminders, updates, and recording should proceed without repeat approvals. |
| Website | The website is the canonical WelcomeFlow record for workflow, decisions, exceptions, configuration, and action status. Extensions and email actions must use that same record. |
| Recruiter extension | A lightweight action door for outstanding work, judgments, and exceptions. Workflow detail remains on the website. |
| Manager visibility | Managers see only active requisitions they own and the related candidates, pending decisions, offers, and hires. Nothing beyond that scope. This is a decided product boundary, not a proposed default or an option clients can widen. |
| Manager extension | A lightweight action door for simple pending hiring decisions and start confirmations within the locked manager visibility boundary. |
| Leadership quick snapshot | Show overdue or escalated items and issues requiring leadership intervention across the leader’s authorized span, with impact, one accountable owner, due time, and next action. No routine daily or weekly pushed summaries. Keep the snapshot lightweight; workflow detail stays on the website. |
| Communication | Email is proactive. Extensions provide backup access to the same work. |
| Send window | Default 7:00 AM–6:30 PM in the recipient’s local time, as explicitly stated in the short CEO handoff. If implementation would instead use recruiter/client timezone, flag that discrepancy rather than silently substituting it. |
| Interview communication | Confirmation at booking, a preparation email 48 hours before, and a reminder 24 hours before an interview scheduled within a week. For shorter notice, send both preparation and reminder only when timing reasonably allows. |
| Post-interview candidate check-in | After confirmed interview completion, send a candidate experience/interest check-in after a short configurable delay, approximately 1–2 hours by default, under the client communication policy. State clearly that it is not an offer or hiring decision. Record responses as workflow/reporting events and surface actionable concerns to recruiting without generating work for routine positive responses. |
| Contextual manager interview reminder | A manager’s upcoming-interview reminder may include a compact, authorized requisition-level snapshot: the upcoming candidate/interview and relevant status and prior recorded feedback/outcomes for other candidates under the same requisition. No second report or unrelated candidate disclosure. |
| Consolidated manager follow-up | Where multiple candidates await manager feedback, group reminders and escalations by requisition and authorized recipient. One actionable message can list outstanding candidates with individual decisions; each candidate keeps its own SLA, decision, timestamps, and audit trail. |
| SLA policy | WelcomeFlow provides defaults that clients can adjust and then use consistently. No role-based SLA tiers. Recruiters do not improvise individual cadences. |
| Escalation | Clients configure escalation routing with exactly one accountable owner at a time. Other participants may contribute or receive permitted notifications. |
| Data authority | Clients designate the authoritative source per category. Direct integrations are not required up front. Authorized human verification is valid when the source, verifier, and time are recorded. |
| Workflow loops | Outreach, scheduling, post-screen handoff, manager/stage decision, offer handoff, and start confirmation each have normal automation, stoppers, and exceptions. Scheduling, completion/feedback, and stage decisions repeat for each required Interview Plan stage. |
| Reporting | Reports derive from work already recorded. Recruiters should not re-enter the same facts for reporting. |
| Configuration | WelcomeFlow owns the standard. Clients adjust supported settings, ownership, timing, templates, industry requirements, and routing. |
| Industry choice | Recruiters select their industry during setup. Trucking is one supported industry. |
| Offer ownership | Configurable by client. Assignment/sending to the designated owner establishes ownership. No separate offer-owner acknowledgment step or acknowledgment reminder. Actual sending failures remain recoverable exceptions. |
| Manager/stage decisions | Three primary actions: Proceed, Hold, Decline. Initial Proceed starts the first configured interview. After an interview, its decision owner’s Proceed advances to the next configured stage. Only completion of the final required stage with a favorable authorized human decision can advance toward offer handoff. Hold sends an active-review note without a promised date. Decline requires a short reason, with optional comment. |
| Configurable Interview Plan | Each requisition supports one or multiple ordered, client-named interview stages appropriate to the role. Each stage has exactly one accountable decision owner and optional supporting interviewers. Panel feedback never independently advances the candidate. |
| Future recruiter-extension intake | Later, a lightweight extension may capture a recruiter-approved candidate/resume in the recruiter’s existing work environment, associate the candidate with an existing requisition, and begin the approved WelcomeFlow workflow without duplicate entry. Recruiter review is required before outreach. This is not a Phase 1 dependency. |
| Approved first implementation priority | Permissions, reliable shared events, exception handling, and failure recovery first; then post-screen handoff → manager decision → interview scheduling → interview completion/feedback → next configured stage or final hiring decision. Multi-stage support belongs in this first workflow. |
| Candidate withdrawal | Record Withdrawn / No Longer Interested separately from a manager decline, with a short candidate reason and optional comment for reporting. |
| Scheduling roadmap | Initial scheduling uses manager-provided availability and candidate selection. Preserve the deferred Phase 2 enhancement: choice of direct calendar booking or manual date/time blocks, plus candidate alternative availability returned to the manager. |
| No guessing | Missing, contradictory, stale, ambiguous, or unauthorized information stops the affected action and routes it to human review. |
| Post-offer scope | Track ownership and outcomes needed to close the recruiting loop. Detailed onboarding execution stays outside the core recruiting scope. |
| Start confirmation | Batch requests for start outcomes while preserving individual candidate records, permissions, and outcomes. |
| Hiring need returned: confirmed A | Return the need to recruiting automatically only when the candidate outcome and the continuing approved hiring need are both confirmed. Uncertainty goes to human review. |
| Recovery | Automation failure must never become silent process failure. Preserve the work, expose the problem, assign an owner, and provide a safe continuation. |
| Inactive candidate review | After 90 days without activity, show a lightweight review card/queue. Client-adjustable. Actions: Keep Active or Remove from WelcomeFlow. No automatic removal or disruptive pop-up. |
| Removal and reporting archive | Remove from WelcomeFlow clears the active workspace and retains only a lightweight reporting record. It does not delete the candidate from the client’s ATS. Do not archive full resumes, applications, attachments, lengthy notes, or full candidate history solely for reporting. |
| Archive retention | Default three years, client-adjustable. Present admin review before purge; purge requires admin approval. This is a product default, not legal/compliance advice. |
| Verification validity | Out of scope for this phase: license/certification/CPR expiry, credential validation, re-verification, and a separate verification-validity feature. Keep named, timestamped source confirmation and current-state/conflict checks for workflow decisions. |
| Current integration boundary | Paycom remains a manual, reviewed copy-and-paste destination. Direct Paycom integration stays parked. |

“Website as source of truth” does not authorize inventing requisition approval, employment status, or external calendar availability. WelcomeFlow must identify the authoritative source for each of those facts and show when it was last verified.

## 4. Build inventory and disposition

**Keep:** preserve the working capability. **Modify:** adjust existing behavior. **Automate:** remove routine human motion after its controls exist. **Add:** a missing capability. **Park:** preserve but defer expansion or implementation.

| Area | Evidence in current build | Disposition | Direction |
|---|---|---|---|
| Candidate intake and saved drafts | Draft persistence, resume field provenance, review, candidate snapshots, and duplicate/identity checks. | **Keep** | Preserve records, review boundaries, imports, and saved work. Capture a fact once. [E1, E2] |
| Requisition and location matching | Exact-context checks and canonical reporting identities are present. Other legacy matching helpers remain. | **Keep / Modify** | Preserve exact checks; apply them consistently before every consequential action. Ambiguous matches stop. [E2, E3] |
| Work page | Needs Action, Today & Scheduled, Pipeline Health, and Handoff Awareness already exist. | **Keep** | Use this as the existing home for action and exception handling. Avoid another competing dashboard. [E4] |
| Unified exception inbox | Derived action items contain context, reasons, destinations, and priorities. Coverage is incomplete for transport, background jobs, saves, and synchronization. | **Modify / Add** | Extend the existing action model into a durable, deduplicated exception record with owner, age, next step, and resolution. [E3, E4] |
| Screening and candidate-ready review | Reviewed packages, content fingerprints, stale-review rejection, and duplicate confirmation guards exist. | **Keep / Automate** | Preserve the human screening judgment and package approval. Automate the approved handoff and tracking afterward. [E2, E5] |
| Outreach | Three-attempt scripts, stop reasons, response/scheduling transitions, and a direct email send path exist. Attempts can still require call/email/text completion or skipping. | **Modify / Automate** | Make channels policy-driven. Run approved outreach and stop it on response, opt-out, booking, expiry, or disqualification of the action. [E1, E6] |
| Communication policy | Candidate email/text Required, Optional, and Off modes; API recipient allowlists, rate limits, and workflow timing editors. | **Modify / Add** | Govern default SLAs and setup changes at client level. Add purpose, contact permission, channel preference, quiet hours, suppression, and escalation ownership. Technical rate limits are not contact policy. [E1, E6, E7] |
| Communication completion | Newer submission actions distinguish opened/copied from sent. Older onboarding handlers mark steps complete when text is copied or a draft opens. | **Modify** | Use consistent states: prepared, queued, provider accepted, delivery confirmed where available, failed, unknown, and manually confirmed. Draft opened is not proof of sending. [E1, E5] |
| Scheduling | Internal calendar, invitation export, scoped expiring booking links, slot reservation, and concurrency checks. Booking creates a request requiring recruiter confirmation. | **Keep / Modify / Automate; Park direct-calendar enhancement** | Initially use manager-provided slots, candidate selection, and confirmed booking. Preserve collision and authority checks; add approved confirmation/preparation/reminder timing. Preserve direct calendar booking and alternative-availability negotiation as the deferred Phase 2 enhancement. [E8] |
| Manager decisions | Feedback aging, reminders, escalation timing, and manual workflow updates. Ownership partly inferred from text/status. | **Modify / Automate** | Use Proceed/Hold/Decline; require a short decline reason, make comments optional, send active-review communication on Hold, and keep candidate withdrawal distinct. Automate routing and capture one accountable owner. [E1, E3, E4] |
| Configurable multi-stage interviews | The prior audit established feedback/calendar foundations but did not establish configurable Interview Plans or panel decision controls. No new source inspection was performed for this revision. | **Modify / Add / Automate motion** | One or multiple ordered stages, one decision owner per stage, supporting panel feedback, and automatic routing after human decisions. Preserve existing modules; never infer a panel vote. [E1, E3, E4, E8] |
| Candidate post-interview experience loop | The prior audit does not establish an automatic, completed-interview-triggered interest/experience check-in. No new source inspection was performed for revision 5. | **Add / Automate** | Prompt after confirmed completion at a configurable short delay, capture interest, experience, optional feedback, and follow-up needs. Route actionable responses to recruiter exceptions; derive routine reporting without an extra task. [E1, E3, E6] |
| Manager interview context and grouped follow-ups | Existing feedback aging and reminders provide a foundation; the prior audit does not establish scoped candidate comparison context or grouped, individually actionable reminders. | **Modify / Automate** | Add compact same-requisition context to upcoming-interview reminders where permitted. Group outstanding feedback reminders/escalations by requisition and authorized manager while retaining each candidate’s SLA and audit event. [E1, E3, E4] |
| Offer handoff | Status map assigns offer activity to recruiter by default; templates and offer follow-up exist. | **Modify / Automate** | Configure the offer owner and record assignment/sending and subsequent outcome. Eliminate the separate acknowledgment step. Human authority controls terms and approval. [E1, E4] |
| Post-offer process | Detailed onboarding sequences and completion checklists exist. | **Modify / Park expansion** | Preserve historical records. Scope the normal recruiter view to handoff, start outcome, delay/withdrawal, and returned need. [E1, E9] |
| Start confirmations | Individual and bulk tentative-start reminder drafts exist. | **Modify / Automate** | Build outcome collection on this foundation. Batch by authorized audience and responsibility, with individual responses. Current bulk composition combines recipients across selected locations. [E1] |
| Hiring need returned | Hire/fill counts and withdrawal/archive helpers exist. A permanent hire record contributes to filled counts. | **Modify / Add** | Implement confirmed A as an explicit, duplicate-safe transition. Preserve the historical hire/outcome and reconcile current vacancy separately. Never reopen a closed or unapproved requisition by assumption. [E9] |
| Reporting | Canonical activity model, period logic, readiness checks, report history, exports, and weekly review flow. | **Keep / Modify / Automate** | Preserve reconciliation and export behavior. Derive reports automatically; send humans only the missing facts or decisions. [E10] |
| Reporting automation controls | UI stores schedule/send settings and can label rows Scheduled. No corresponding durable scheduler was found in the inspected API/config paths. | **Modify / Add** | Label configured intent accurately until execution exists. Require observable job and delivery outcomes before claiming automatic operation. [E1, E10, E13] |
| Audit trail | Timestamped history, candidate audit arrays, and stronger server audit for controlled copy/open actions. General history is capped at 200 entries; actors/reasons vary. | **Keep / Modify / Add** | Extend a durable actor/action/reason trail across all events. Keep operational history separate from generated reports. [E1, E11] |
| Access control | Owner UAT login, API role/workspace membership checks, runtime boundaries, and database protections. Production authentication is explicitly unavailable in runtime configuration. | **Keep / Add** | Preserve safeguards; add and verify client, ownership, role, and field-level access before multi-user release. Enforce manager access only to owned active requisitions and their related candidates, pending decisions, offers, and hires. [E7, E12] |
| Data authority and manual verification | Imported values, recruiter edits, source markers, and timestamps exist in several flows; no uniform category-level authority registry was found. | **Keep / Modify / Add** | Preserve provenance already captured. Add a client-designated source per category and reuse valid named, timestamped human verification without requiring connectors. [E1, E2, E8] |
| Failure recovery | Email errors surface a fallback notice; booking rejects conflicts; saves have some version/conflict protection. | **Modify / Add** | Add durable recovery ownership, safe retries, unknown-result handling, and reconciliation. A temporary notification is insufficient. [E1, E6, E8, E14] |
| Industry setup | Draft #15 adds six profiles, additive role starters, role-specific screening, and template preservation. | **Keep / Modify** | Preserve the draft. Fit it into actual account/workspace onboarding and the common product standard. [E15] |
| Training and support | Draft #15 has lessons, isolated practice, searchable help; progress is session-only. | **Keep / Modify / Add** | Teach judgment and recovery. Add saved per-user progress and an explicit escalation route after roles exist. Avoid teaching obsolete click sequences. [E15] |
| Recruiter and manager extensions | No recruiter or manager browser-extension implementation found in the inspected repository. The existing manifest belongs to the web app. | **Add later** | Provide lightweight action doors backed by the same website record. Recruiters receive work/exceptions; managers receive decisions/starts only within their owned active requisitions. [E13] |
| Recruiter-extension intake concept | The prior audit does not establish a browser-extension candidate capture flow. | **Park for future extension** | Eventually capture a recruiter-reviewed candidate/resume from the existing work environment, associate it with an existing requisition, and start the approved workflow without repeat entry. Require human review before outreach; keep this out of the first implementation scope. [E1, E2, E13] |
| Leadership quick snapshot | Existing reporting supplies roll-up foundations; the scoped action snapshot remains to be implemented and verified. | **Modify / Add** | Limit snapshot and proactive leadership alerts to overdue/escalated items or issues requiring leadership intervention, within the leader’s span. Include impact, owner, due time, and next action. Do not schedule routine leadership summaries. [E10] |
| Inactive review and reporting archive | Archive/withdrawal helpers and historical reporting exist; the latest review/removal/minimal-archive rules were not established by the prior audit. | **Modify / Add** | Add configurable 90-day review, Keep Active/Remove actions, a lightweight reporting archive, configurable three-year retention, and admin review before purge. Assess existing data handling before implementation; no data deletion in this document task. [E9, E10] |
| Credential and verification-validity functions | No new source inspection was performed for this policy revision. | **Park / Out of scope** | Do not add credential validation or expiry/re-verification tracking. External systems own this work; named source confirmation remains a workflow safeguard. |
| Direct ATS/Paycom integration and client-specific forks | Current workflow supports manual ATS notes; the product direction favors settings. | **Park** | Keep manual notes usable. Defer integrations and avoid separate codebases per client or industry. |

## 5. Seven operating controls

### 5.1 Permissions and boundaries

Manager visibility and the leadership quick snapshot below are **locked CEO decisions**. The remaining role/action details are proposed for specification approval. Enforce every boundary on the server and data access paths, not just by hiding buttons.

| Actor | Can see | Can do | Boundary |
|---|---|---|---|
| Client administrator | Their client’s configuration and permitted records | Assign roles, configure routing and policy within WelcomeFlow limits | No access to another client; administrative access does not silently grant every hiring decision |
| Recruiter | Assigned work and explicitly shared recruiting scope | Screen, approve handoffs, resolve permitted exceptions, record confirmed outcomes | No inferred authority to approve offer terms or override protected requirements |
| Hiring manager | Only active requisitions they own and related candidates, pending decisions, offers, and hires | Record authorized decisions, request clarification, and confirm permitted outcomes within that scope | No non-owned or inactive requisitions, unrelated records, or private recruiter notes. Client settings cannot widen this manager-role boundary |
| Assigned stage decision owner | The assigned stage’s authorized candidate packet, scheduling context, and supporting feedback | Record Proceed/Hold/Decline for that stage and provide scheduling availability within authority | Exactly one active decision owner per stage; assignment requires explicit access authorization and grants no broad requisition browsing |
| Additional interviewer/panel member | Only the assigned interview packet and feedback task needed to participate | Provide supporting feedback | Feedback cannot advance, hold, decline, or approve an offer; no unrelated records or broad requisition access |
| Offer/HR owner | Assigned handoff packet and necessary outcome fields | Act on assigned handoff and record authorized offer/start outcomes; no acknowledgment task | Sensitive HR details shared only where needed |
| Leadership | A quick snapshot of overdue/escalated items or issues requiring intervention across their authorized span, with impact, one accountable owner, and due time | Act on permitted escalations and open necessary detail on the website | No routine summary pushes, out-of-span totals, or deep reporting in the snapshot. Roll-up access does not automatically grant editing or messaging rights |
| Candidate | Their own scoped communication and scheduling request | Respond, choose permitted times, update contact preferences | No workspace browsing or access to other candidates |
| WelcomeFlow automation | Only the authority required for the configured action | Execute approved motion and record its outcome | Cannot create hiring authority, select a candidate, infer a decision, or resolve ambiguity |

Extensions inherit these same permissions. Bulk operations must partition records by the audience entitled to see them. Support access needs an explicit, time-bounded support policy and an audit trail.

The manager boundary applies to website lists, search, detail, exports, proactive email content, secure email actions, and extensions. Check current requisition ownership and active status before displaying or releasing information and before accepting an action. Reassignment or an inactive requisition removes manager access, including through old links and pending actions. Preserve the underlying records and audit history for authorized roles; never change requisition status merely to grant access. A related candidate does not grant access to their unrelated applications. Offer or hire visibility does not itself grant authority to approve offer terms or alter employment facts.

### 5.2 Communication policy

Before an automated message is eligible, WelcomeFlow must know the recipient, purpose, allowed channel, applicable contact permission, approved template, cadence, stop conditions, and accountable owner. Unknown contact permission goes to review. An unknown recipient timezone must not be silently replaced with a default for scheduled outreach.

WelcomeFlow owns the default SLA policy. Authorized clients adjust timing and routing to their operating environment; the configured policy then applies consistently. Do not create role-based SLA tiers. Recruiters cannot change their own cadence or silently reset clocks. A permitted case exception is recorded with reason, owner, and expiry without changing the shared policy.

CEO-01 is closed. The latest handoff replaces the old send window, single interview reminder, offer acknowledgment requirement, and routine leadership-summary proposal. Earlier outreach/manager/start timing values below remain configurable defaults carried forward from the working specification; they are not universal recruiting rules. Do not invent fixed adjustment ranges or a new approval ladder. The policy is versioned; each running action records its governing policy.

| Audience/purpose | Normal motion and configurable defaults | Stop or exception |
|---|---|---|
| Candidate outreach | Initial email plus up to two follow-ups, two configured working days apart | Stop on reply, booking, withdrawal, opt-out, hard bounce, closed need, or attempt cap |
| Candidate status updates | Event-driven updates after confirmed milestones; a new Hold sends an active-review note without a decision date. Existing default limits other waiting updates to at most once per two working days | Avoid duplicate updates and repeated Hold notices for the same unchanged state; do not imply an unconfirmed decision |
| Post-interview candidate experience | After confirmed interview completion, check in approximately 1–2 hours later by default, with a client-adjustable delay and approved send window | State that this is not an offer or hiring decision; suppress if the candidate withdrew, contact permission changed, or the same completed-stage check-in was already sent. Treat actionable replies as exceptions, not routine positive replies |
| Scheduling | Confirmation at booking, 48-hour preparation email, and 24-hour reminder for an interview scheduled within a week | On short notice, send both prep and reminder only if timing reasonably allows; no expired or duplicate messages. Conflicts and broken links enter recovery |
| Manager decision | Proactive request, first reminder after one working day, escalation to the configured owner after three; group due candidates by requisition and authorized recipient | Stop reminders for each candidate when its valid decision arrives; one message may request several distinct decisions without merging their clocks or outcomes |
| Offer handoff | Assign/send to the configured offer owner and record the handoff; no separate acknowledgment or ownership-confirmation reminder | Missing owner, missing approval, unresolved terms, or send failure routes to the existing exception path |
| Start outcomes | One daily batch per authorized owner/location group for due confirmations | Individual outcomes stay separate; no response means unknown, not started or no-show |
| Leadership | In-view snapshot and proactive alerts only for overdue/escalated items or a genuine need for leadership intervention | No routine daily/weekly pushed summaries or unrestricted candidate lists; remain within the leader’s span |

**Locked default send window: 7:00 AM–6:30 PM, recipient local time**, following the explicit short handoff. The longer handoff also mentions the recruiter/client environment: retain that context for client settings, but do not silently substitute recruiter timezone for recipient timezone. Flag any implementation dependency that makes this distinction material. Support configured working days, including weekend operations. SMS is separately enabled only with the necessary permission and an implemented transport; text templates alone do not establish connectivity. A human call remains a human activity where useful, not a mandatory box for every outreach attempt.

For short-notice interviews, “timing reasonably allows” is a locked product intent, not permission to invent a minimum gap or send both messages together after their purpose has passed. Preserve both planned communications when useful; surface a material scheduling-policy conflict for a single focused decision before implementing it. Confirmation at booking remains the intended behavior; a booking outside the send window needs an explicit channel/timing resolution before that edge case is enabled.

### 5.3 One exception inbox

Extend Needs Action in the existing Work page. Every actionable exception should contain:

- The affected person/opening and workflow loop.
- What happened, why the action stopped, and the verified evidence available.
- One accountable owner, due time, escalation path, and current age.
- The next safe action, plus permitted alternatives.
- First occurrence, latest occurrence, attempts, and linked audit events.
- State: new, assigned, waiting, snoozed, resolved, or reopened.

The same underlying issue should appear once, even if it affects reporting, email, and an extension. Healthy waiting belongs in Handoff Awareness. An overdue, failed, or uncertain handoff belongs in Needs Action. Missing ownership routes to the configured client fallback owner.

### 5.4 Automation fail-safes and decision matrix

An action runs only when identity, permission, current state, required human judgment, recipient/channel policy, and authoritative facts are valid. Recheck them immediately before execution. A material change invalidates prior approval. Stop the affected loop; unrelated valid work may continue.

| Loop | Human judgment | Normal automatic motion | Stoppers | Exception response |
|---|---|---|---|---|
| Outreach | Recruiter confirms appropriate opportunity and any exception | Approved sequence, response recording, stop/cancel follow-ups, owner routing | Unclear identity, prohibited contact, inactive need, unknown channel permission, exhausted cadence | Assign to recruiter with exact reason; preserve attempted/contact status |
| Scheduling | Initially the manager provides interview slots and the candidate selects one | Offer valid supplied slots, reserve once, confirm at booking, send timely prep/reminder, record changes | Stale availability, conflict, expired link, missing timezone, ambiguous reply | Preserve request; provide a manual recovery route. Direct calendar booking and candidate alternative-availability negotiation remain deferred |
| Post-screen handoff | Recruiter records screen outcome and approves candidate packet | Route the approved packet, record handoff, start decision timer | Missing required facts, stale approval, unclear recipient, unresolved eligibility | Return to the precise owner/field needing attention |
| Manager/stage decision | Initial manager and then each stage’s single designated owner choose Proceed, Hold, or Decline; Decline requires a short reason | Initial Proceed starts stage one. Following completion/feedback, owner Proceed routes to the next configured stage; final-stage completion and a favorable human decision permit movement toward offer handoff. Hold sends active-review note without a date. Group manager follow-ups by requisition and recipient, preserving individual decision links and clocks | Missing/unauthorized owner, changed plan/opening, incomplete required stage, conflicting decision, uncertain interview completion | Keep affected stage pending in one exception; never infer a decision from panel feedback, silence, elapsed time, or a missing next stage |
| Offer handoff | Authorized people approve terms and designate the offer owner | Assign/send approved packet and track the reported outcome; no separate acknowledgment step | Missing owner, unapproved terms, missing required evidence, send failure | Assign to the accountable offer owner/recruiter and escalate under client policy without adding ownership-confirmation work |
| Start confirmation | Authorized source confirms each outcome | Batch requests, record confirmed outcomes, update reports; return a confirmed continuing need under rule A | No response, conflicting start dates, uncertain outcome, unconfirmed ongoing approval | Review the individual item; other confirmed items in the batch may complete |

**Returned-need rule:** A confirmed withdrawal, decline, or unsuccessful start plus a confirmed still-approved vacancy creates one return-to-recruiting event and assigned recruiting action. It does not automatically create a new requisition, undo a cancellation, or erase the candidate’s earlier history. A changed or expired approval routes to review.

### 5.5 Data ownership

**Locked:** the client designates data authority per category. The category mapping below specifies how to apply that direction. Named, timestamped human verification is an accepted path before integrations exist.

| Information | Authority rule | WelcomeFlow responsibility |
|---|---|---|
| Workflow, tasks, decisions, exceptions, communication action status | WelcomeFlow website and its shared service | Keep one canonical record across website, extensions, and email actions |
| Requisition approval, opening count, cancellation | Source designated by client during setup | Store stable identifiers, source, verification time, and approver; do not silently override |
| Offer terms and employment/start outcomes | Designated authorized HR/offer source or authorized human confirmation | Store the outcome and provenance needed for recruiting; avoid duplicating detailed HR processing |
| Calendar availability and reservations | Designated scheduling/calendar source | Distinguish requested, reserved, confirmed, cancelled, and sync-unknown |
| Candidate contact preferences | Candidate’s latest verified preference plus client contact policy | Enforce suppression across every communication loop |
| Reports | Derived from the above facts and events | Show freshness and unresolved gaps without creating another editable truth |

Without a connector, a named, timestamped manual confirmation can record a source fact. Store when the fact took effect separately when known. Reuse the recorded fact; ask again only when a relevant change or conflict affects the action. Verification-expiry timers and credential re-verification are out of scope. Conflicting sources do not become “latest write wins.” Keep the conflict visible until resolved. Website workflow state and external facts must be reconciled before affected automation resumes.

### 5.6 Audit trail

Record who did what, when, and why for both people and automation. Proposed minimum event fields:

- Stable event ID; client/workspace; candidate/opening/workflow references.
- Actor identity and role, or system job identity; action and reason.
- Occurred-at and recorded-at timestamps, preserving actual source time when available.
- Relevant before/after values, source reference, and verification status.
- Policy/template version and approval reference used for the action.
- Result, error category, correlation ID, and duplicate-prevention key.
- Correction or superseding-event link; retention classification.

A retrospective update must not claim it occurred at the moment it was entered. Historical unknown timestamps remain unknown. Corrections create traceable events rather than silently rewriting history. Restrict sensitive content; an audit event does not need a complete message body in every case. The existing limited communication audit is a foundation, not yet universal coverage.

### 5.7 Failure recovery, in plain language

| Failure | What happens next |
|---|---|
| Email is rejected or bounces | Keep the recruiting step open. Record failure, stop unsafe repeat sends, and assign an exception. Offer a permitted alternative channel or corrected recipient. |
| Email request times out after submission | Label the result unknown. Check provider evidence before retrying. Do not send a second message merely because the first result was lost. |
| Calendar link expires or breaks | Keep the scheduling request. Generate a replacement only if authority and availability are still valid; otherwise assign a manual scheduling task. Tell the candidate the request is pending. |
| A slot is taken | Preserve the candidate’s request and offer valid alternatives. Do not label an unreserved time confirmed. |
| Saving fails or records conflict | Keep unsaved intent visible, pause dependent external actions, and reconcile against the latest authorized record. Do not claim success or overwrite another person’s work silently. |
| A background worker stops | A separate health check identifies overdue work, alerts the accountable operator, and exposes affected items. Restart resumes eligible pending work without replaying completed actions. |
| Audit recording is unavailable | Hold new consequential external actions until they can be durably recorded. If an external action already occurred, preserve its evidence and reconcile before any retry. |
| Recipient or owner is missing | Route to the configured fallback owner. Never guess an email address or person. |
| A manager/start-confirmation response is unclear | Request clarification and retain the pending state. No reply or vague wording is not a hiring or employment outcome. |
| Automation is deliberately paused | Preserve queued work and its age. Resume only after rechecking changed facts, approvals, contact policy, and duplicates. |

Retry transient technical failures only, with a bounded attempt policy and increasing delay. Authorization failures, invalid recipients, business contradictions, and unknown prior-send outcomes require resolution rather than blind retries. Manual recovery records what actually happened and cancels obsolete automatic work.

## 6. Proposed plan, preserving the build

Each phase extends existing modules. The plan below is a proposal, not authorization to begin implementation.

### Phase 1: Settle the operating standard

CEO-04 is approved with revision; CEO-01 through CEO-03 remain closed. Submit this final specification for explicit approval before application changes. Preserve all locked defaults and boundaries. Multi-stage interviews belong in the approved first implementation priority and must not be deferred to the later direct-calendar scheduling enhancement.

Review every required click: identify the judgment it captures. Routine confirmations without a distinct decision are candidates for automation. Preserve current layouts, records, templates, identifiers, and historical exports.

**Exit:** The selected first scope and final specification are explicitly approved. No ambiguous owner, source, stopper, or outcome remains in that scope. Client-adjustable settings do not require arbitrary universal recruiting ranges or SLA tiers.

### Phase 2: Establish trustworthy shared events and recovery

Extend the existing audit and Work-page models to cover consistent action results, ownership, deduplication, exceptions, safe replay, and save conflicts. Correct copied/opened-versus-completed semantics. Apply server-enforced permissions and safe recipient scoping.

**Exit:** Simulated failure, duplicate execution, stale approval, unauthorized access, and conflicting updates cannot silently advance a candidate, lose a task, or expose another audience’s records.

### Phase 3: Automate the complete configured interview workflow

Approved priority: post-screen handoff → manager decision → interview scheduling → interview completion/feedback → next configured interview stage or final hiring decision. Extend existing submission, Work page, feedback, and calendar foundations. Use a requisition-level Interview Plan with one or multiple stages, each with one accountable decision owner and optional supporting interviewers. Initially use manager-provided interview slots. Collect completion/feedback and route the owner’s human decision: Proceed advances to the next configured stage; Hold sends active-review communication without a date; Decline records a short reason. Only final required stage completion and a favorable authorized decision can move toward offer handoff. Keep withdrawal distinct.

Automate routing, manager/stage-owner requests, contextual interview reminders, requisition-grouped feedback follow-ups, escalation, candidate scheduling communication, confirmations, interview reminders, the post-interview candidate experience check-in, status changes, timestamps, and reporting between human decisions. Negative or actionable candidate replies create a specific recruiter exception; routine positive replies become events without a task. Never automate suitability judgments or turn panel feedback or candidate sentiment into a binding hiring decision.

**Exit:** A one-stage CNA plan and a three-stage executive plan reach a human final decision using the same configurable workflow. Panel feedback cannot advance the candidate. Required stages cannot be silently skipped, and stale or duplicate actions cannot create another transition. A blocked case appears once with its owner and next safe action. Routine motion requires no repeated copy/open/mark-complete work.

### Phase 4: Extend to outreach, scheduling, offer handoff, and start outcomes

Use the same control model for approved outreach, remaining scheduling/recovery cases, configurable offer ownership without an acknowledgment step, recipient-scoped start batches, and automatic return of confirmed continuing hiring needs. Keep post-offer work limited to handoff and outcomes. Keep Paycom manual. Direct calendar self-booking and alternative-time negotiation remain the separately deferred scheduling enhancement; the client does not need direct integrations for the initial workflow.

**Exit:** All six loops have tested normal paths, stoppers, exceptions, and recoveries. One confirmed failure-to-start returns one approved need, while uncertain or cancelled needs remain held for review.

### Phase 5: Make reporting and access follow the workflow

Deliver the leadership quick snapshot for overdue/escalated items and issues requiring intervention across each leader’s authorized span, derived from the event record. Include the accountable owner, due time, and next action; do not push routine summaries. Preserve the existing reporting model and reconciliation. Add inactive review, minimal reporting archive, configurable retention, and admin review before purge. Add recruiter and manager extensions as lightweight action doors over the same website service. Manager access remains limited to owned active requisitions and their related candidates, pending decisions, offers, and hires. Full workflow detail and deep reporting remain website capabilities where authorized. Adapt training to decisions and recovery; persist user progress and provide support escalation. Preserve recruiter-extension candidate/resume capture as a later enhancement, not a prerequisite for this phase or the first interview workflow.

**Exit:** Website, proactive email actions, and extensions show the same current state and permissions. Leadership can identify and act on issues across their authorized span from the quick snapshot. Recruiters do not enter duplicate facts for reporting. Loss of extension access does not strand work.

### Phase 6: Pilot and measure

Run representative scenarios in at least two industries, including trucking, with mobile and desktop acceptance. Compare against a measured baseline for routine touches per candidate, administrative time, handoff/decision delays, unresolved exceptions, communication failures, and report preparation time. Measure missed or duplicate actions as well as speed.

**Exit:** Evidence demonstrates reduced admin without weakened judgment, privacy, or accuracy. Publish no numerical time-saving claim before measurement.

## 7. Review specification

This section combines locked product behavior and detailed specification proposals for final review. It does not authorize application changes. The latest CEO handoff and locked direction in section 3 supersede earlier proposals. CEO-04 is approved with revision; implementation remains paused pending explicit final specification approval.

### S1. Product surfaces and boundaries

| Surface | What belongs here | Primary actions | What opens on the website |
|---|---|---|---|
| Website | Active workflow record, candidate/opening context, configuration, exception detail, audit trail, lightweight historical reporting and training | Manage authorized work, review evidence, resolve complex exceptions and configure the client | Workflow detail is here; the client’s ATS retains long-term applicant records |
| Recruiter extension | Assigned outstanding work and exceptions, with just enough context to act; a later enhancement may capture a recruiter-approved candidate/resume from the current work environment | Record a judgment, resolve a simple exception, or reassign within authority. Future capture associates an approved candidate with an existing requisition without repeat entry | Workflow intake, current workflow history, configuration, complex review, and required human approval before outreach |
| Manager extension | Pending decisions and start confirmations only for active requisitions the manager owns, with relevant candidate, offer, and hire context | Proceed to the next configured stage and provide slots as needed; Hold; Decline with a short reason; record permitted stage/final decisions and start outcomes | Approved candidate packet and supporting workflow detail, subject to the same owned-active-requisition boundary |
| Leadership quick snapshot | Overdue/escalated items and intervention needs across the leader’s authorized span, with impact, one accountable owner, due time, and requested intervention | Open the specific permitted action or resolve an authorized escalation | Detailed workflow and any permitted reporting analysis |
| Email | Proactive requests, updates and reminders under the client policy | Respond or open the specific secure action | The same current action/record used by extensions |

An extension must not duplicate full intake, administration, configuration, or report-building screens. Every quick action addresses an existing website record, checks current authority and state, and records the result there. If more context is needed, the action opens the precise website record. Installing or opening an extension is never a prerequisite for receiving essential work.

**Future recruiter-extension capture:** from an existing recruiter work environment, permit a lightweight candidate/resume capture after recruiter review, exact association with an existing active requisition, and initiation of the approved WelcomeFlow workflow. Check identity, duplicates, current requisition authority, and contact policy before acting. Capture does not authorize outreach until the recruiter has reviewed and approved the candidate and message. Do not turn the extension into a parallel applicant database or require it for Phase 1.

**Locked manager visibility:** managers see only active requisitions they own and related candidates, pending decisions, offers, and hires. Nothing beyond that scope. This is not awaiting approval. An assignment to a location, team, or escalation does not grant broader manager visibility. Client configuration records ownership; it cannot widen the manager boundary. Website navigation, email, and extensions enforce the same current ownership and active-status checks.

**Locked leadership quick snapshot:** include a compact view of overdue/escalated items and issues requiring intervention across the leader’s authorized span. Examples: several overdue manager decisions, an ownership conflict, or an offer/process bottleneck requiring leadership. Healthy pending work does not generate a leadership alert. Do not push daily or weekly summaries. Each roll-up exposes impact, one accountable owner, due time, and the permitted next action. Show freshness and unknown outcomes from the event record; apply span permissions to totals and detail. Detailed workflow review, configuration, and report building remain on the website.

### S2. Client setup and operating policy

Setup captures the industry profile, requisition ownership, each requisition’s Interview Plan (ordered stages, decision owners, supporting interviewers), recruiter assignments, authorized leadership span, category-specific authoritative sources, default communication policy, operating days/timezones, offer owner, and escalation owner/fallback. Ownership and span are client setup values within the locked role boundaries. Use WelcomeFlow defaults to minimize setup effort. Show only settings needed for enabled workflows; incomplete configuration holds only the affected action.

WelcomeFlow owns required event meanings, ambiguity handling, permission enforcement, auditability, and safe recovery. Clients configure supported values and named owners. Recruiters operate within that policy. Policy changes require the configured administrative authority, a reason, an effective time, and an audit event. They must not silently rewrite earlier performance or reset existing SLA clocks.

Direct ATS, HR, and calendar connections are optional. A client can operate with authorized human verification. Automated transport is enabled only for channels with a working, verified capability. A manually sent email may be confirmed by the authorized sender; opening a draft alone never counts as sent. The system labels the actual mode honestly and automates internal routing, timing, and report derivation wherever valid facts permit it.

### S3. Source verification and records

Each authority category has one client-designated current source and a person/role authorized to confirm workflow facts. The source may be WelcomeFlow, an external system, or a designated human authority. A reference to an external system does not imply synchronization. Verification-validity timers, credential validation, and license/certification/CPR expiry or re-verification are outside this phase.

A verified fact records the affected entity, value/outcome, named source, named verifier, verification timestamp, and effective timestamp when known. Store any necessary evidence reference without requiring redundant document entry. Reuse existing valid facts in candidate records, handoffs, scheduling, and reports.

When sources disagree, keep both claims and route one exception to the accountable owner. Do not pick the newest entry by default. When a user corrects a fact, retain what changed and why, and recheck only the actions affected by the correction.

### S4. Common workflow contract

Every loop must define its trigger, required authoritative facts, human decision point, normal automatic action, successful completion evidence, SLA start/stop events, one accountable owner, stoppers, and recovery route. Use the six-loop decision matrix in section 5.4.

Successful routine actions update status, timestamps, the next owner/action, and reporting automatically. They must not ask the recruiter to repeat those entries. Human review is for a decision or a specific uncertainty. A blanket approval prompt on every routine step does not meet the standard.

Completion evidence is specific to the action: a provider acknowledgment can establish email submission to the provider; a delivery event establishes delivery where available; an authorized manual confirmation establishes manually verified sending. None establishes a manager decision. A calendar request is distinct from a confirmed reservation. An offer acceptance is distinct from an actual start.

Proposed start outcomes: Started, Did not start, Delayed with revised date, and Unknown/Needs review. The named authority confirms the outcome; the system never infers it solely from a passed date. A batch permits individual answers and partial completion, with no default “all started” selection.

#### Locked manager decisions and candidate outcomes

| Action/outcome | Meaning | Resulting motion |
|---|---|---|
| Proceed | Move to the next required step in the configured Interview Plan | Initial Proceed starts the first interview. After confirmed stage completion/feedback, that stage’s owner advances to the next configured stage. Only a favorable authorized decision after the final required stage can move toward offer handoff; it does not approve offer terms |
| Hold | Candidate is still under consideration while the manager reviews additional candidates | Send a respectful note such as “Your application is in active review.” No promised decision date and no long required explanation |
| Decline | Manager decides not to proceed | Require a short reason dropdown; allow an optional comment. Record the outcome and reason for reporting |
| Withdrawn / No Longer Interested | Candidate chooses to leave the process, including after a Proceed decision | Record a distinct candidate outcome and short reason; cancel obsolete work and retain reporting facts. Do not classify it as manager rejection |

Suggested decline reasons are insufficient experience, minimum qualifications not met, education requirement not met, background/experience does not align with the position, availability/schedule mismatch, and Other. The exact taxonomy can be refined later; selecting a reason does not initiate a background check or credential validation.

Suggested withdrawal reasons are accepted another position, staying with current employer, compensation, schedule, no longer interested, and Other, with an optional comment. Do not infer withdrawal from silence or inactivity.

#### Configurable Interview Plan: included in the first workflow

The same workflow supports one interview or several. Configure an ordered Interview Plan per requisition, suitable for its role, with client-defined stage names. Each stage records its order, one accountable decision owner, additional interviewers if any, and the scheduling context. Each candidate’s workflow records the applicable plan and current stage so routing never guesses where they go next. Do not add parallel product versions for different industries or seniority levels.

| Step | Human responsibility | Automatic motion and guard |
|---|---|---|
| Approved screen and initial manager decision | Recruiter approves the screen/packet; authorized manager chooses Proceed, Hold, or Decline | Proceed creates the first configured interview-stage work once; route to its owner |
| Scheduling for each stage | Manager/stage owner provides slots; candidate selects a suitable offered time | Record a valid booking and send approved stage-specific confirmation, preparation, and reminders |
| Interview completion and feedback | Authorized participant records whether the interview occurred and supplies feedback; panel members may each contribute | Capture who recorded what and when, present the stage owner with the decision task, and schedule the candidate experience check-in only after confirmed completion. A calendar end time does not prove attendance or completion |
| Non-final stage decision | The single stage owner chooses Proceed, Hold, or Decline | Proceed advances once to the next configured stage, routes ownership, and starts that stage’s scheduling/communication. Hold stays at the current stage and sends active-review language without a date. Decline stops future-stage work and records its reason |
| Final required stage | The designated owner makes the final human decision after the required interview work is complete | A favorable decision can make the case ready for offer handoff, subject to existing authority/approved terms and configured offer ownership. Never generate or approve offer terms from interview feedback |

Panel members provide supporting feedback, not competing workflow decisions. Differences of opinion go to the designated owner for human judgment. No vote count, score average, majority, AI interpretation, or first/last feedback submission may automatically advance or reject the candidate. Feedback is supporting evidence and does not require every panel member to approve the owner’s decision. Missing required information or an uncertain completion state routes to human review; never silently invent a quorum or waiting rule.

Stage assignment grants only an explicitly authorized stage task and necessary packet. It does not widen manager browsing beyond owned active requisitions, grant access to unrelated candidates, or turn a leadership snapshot into candidate-level access. A stage owner must have current decision authority; a panel member must have current feedback authority. Missing authorization or an inactive requisition stops the affected action and routes it to the accountable owner.

Record stage identity, plan version, decision owner, scheduled time, confirmed completion, feedback timestamps, decision/reason, and transition time as workflow events. Reports derive stage waiting time and outcomes from those events without duplicate entry. The lightweight archive policy still applies when active work ends; multi-stage support does not justify retaining full interview notes indefinitely.

Preserve recorded decisions and stage history when ownership or configuration changes. Audit who changed the plan/owner and why; reconcile affected active cases before routing further work. Do not silently skip required stages, overwrite prior decisions, apply another requisition’s plan, or reopen completed stages. Stale links, duplicate submissions, and retries must not advance a candidate twice. Withdrawal cancels obsolete future-stage actions while retaining its distinct reporting outcome. A missing next-stage configuration is an exception, not evidence that the candidate is ready for offer handoff.

**Examples using the same standard:**

| Requisition example | Configured Interview Plan | Completion boundary |
|---|---|---|
| CNA with one interview | Recruiter-approved screen → initial manager Proceed → hiring manager interview → stage-owner final decision | Only the completed required interview and favorable human final decision can lead toward offer handoff |
| AVP with three interviews | Recruiter-approved screen → initial manager Proceed → VP interview → owner Proceed → second leader interview → owner Proceed → executive/panel interview → owner final decision | VP and second-leader Proceed decisions route to the next interview. Only the final required stage can lead toward offer handoff |

The workflow automates routing, requests, reminders, escalation, candidate scheduling communication, confirmations, interview reminders, status changes, timestamps, and reporting. Human hiring judgment remains human at every stage.

#### Post-interview candidate experience and interest

After confirmed completion of each interview stage, queue one candidate check-in for that stage after a short configurable delay, approximately 1–2 hours by default. Apply the approved channel, contact permission, client policy, and send window at the actual send time. Do not use the scheduled interview end as proof of completion. If the send window delays a queued check-in, preserve the intent and recheck whether it is still relevant before sending; do not deliver stale or duplicate requests. The check-in says plainly that it is a request for feedback and interest, **not an offer or hiring decision**.

Ask whether the candidate remains interested; how the interview or facility experience went using a simple response; whether they have optional additional feedback; and whether they have unanswered questions or want recruiting/HR follow-up. Keep the response short and optional where appropriate. Record each response with stage, candidate, timestamp, and source as a workflow/reporting event. A positive response that requires no help updates the record without an exception. A negative experience, loss of interest, unresolved question, or follow-up request creates one actionable recruiter exception for that candidate/stage; route to HR only within the client’s authorized policy. A loss-of-interest response is not automatically a confirmed withdrawal or manager decline; request clarification or confirmation where necessary. Candidate sentiment cannot set the manager’s Proceed/Hold/Decline decision, replace panel feedback, or imply an offer.

#### Manager context and consolidated communications

An upcoming-interview reminder to an authorized manager includes compact context for that requisition: the upcoming candidate and stage/time, plus relevant current status and previously recorded feedback/outcomes for other candidates being considered for the same requisition. Limit detail to what this recipient is permitted to see; do not expose private recruiter notes, unrelated candidate applications, records for another requisition, or an inactive/non-owned requisition. Use the current website state at send time and link to the authorized detail. This reminder assists recall and preparation without asking the manager to create a report.

When feedback or stage decisions for multiple candidates are due for the same requisition and authorized recipient, send one consolidated actionable reminder or escalation where possible. Clearly distinguish candidates, stages, outstanding action, and each applicable due status; allow a separate decision or feedback response per candidate. Retain a separate candidate/stage SLA clock, decision owner, timestamp, and audit event. A grouped email is a delivery container, not a combined candidate decision. Recheck all items and recipient authorization before sending so a resolved, reassigned, or out-of-scope item drops from the message. If one item fails, keep its exception and other valid actions independently actionable. Escalations still have exactly one accountable owner per affected action under the client’s routing policy.

#### Scheduling enhancement preserved for Phase 2

This is the CEO’s later scheduling enhancement, separate from the numbered delivery phases in section 6. Preserve two modes: candidate direct booking against available calendar time, or manager-provided dates/time blocks. If none work, let the candidate select “None of these work” and suggest alternatives, which return to the manager for approval or another proposal. It is deferred because it requires more build work; do not lose it or make it a prerequisite for the initial supplied-slot flow.

### S5. SLA and escalation behavior

Each SLA uses a named starting event, a configured working calendar/timezone, deadline, reminder schedule, stop conditions, and escalation route. Candidate response, manager decision, confirmed booking, withdrawal, or changed need cancels obsolete queued follow-ups. Revalidate eligibility immediately before sending.

For manager response timing, proposed start is the recorded issue of the decision request through an authorized channel. Delivery failure is an automation exception and must be distinguishable from manager delay. Merely generating a draft does not start a sent-request clock. Report delivery uncertainty explicitly.

Administrative SLA pauses, when supported by the approved client policy, require a reason and internal review/resume time. This is distinct from the manager’s Hold action: Hold must not force a promised candidate decision date or add an unnecessary date-entry step. Show total elapsed time and policy-adjusted SLA time; do not hide delay by snoozing. Routine edits, reassignment, retries, and changing a display label do not restart the original clock. A material new request creates a linked new event with its own clock and reason.

Each escalation has exactly one accountable owner at a time. A client may configure additional contributors or notification recipients within permissions. An ownership transfer records the prior owner, new owner, time, and reason, with a configured fallback if the receiving person is unavailable. Sending an escalation notification does not itself resolve the underlying issue.

### S6. Exception lifecycle and recovery

Use the existing Work page’s Needs Action area as the website inbox. Extension and email views refer to those same exception records. Link multiple symptoms of one problem rather than creating three separate tasks for the same failure.

The exception has an owner, reason, affected records, due time, suggested safe action, history, and a clear current state. Resolution requires the missing decision/fact or confirmed recovery outcome. Snooze sets a return time. A recurrence after resolution reopens the linked issue and retains history.

Preserve intended work when automation fails. Apply the recovery table in section 5.7. Retry only when safe; an uncertain external result must be reconciled before replay. A manual completion records evidence and cancels pending duplicates. If the website service is unavailable, quick actions show that they were not confirmed and remain pending until a durable result is known.

### S7. Offer handoff, start batching, and returned need

The client configures the authorized offer owner. Assignment/sending establishes ownership; record the recipient, approved packet, handoff time, actual sending status, and next expected outcome under client policy. Do not add an acknowledgment task, deadline, or reminder. An uncertain or failed send remains an exception and never counts as confirmed delivery. Additional collaborators do not create multiple accountable owners.

After offer handoff, WelcomeFlow tracks recruiting-relevant outcomes and exceptions. Preserve existing onboarding records and avoid expanding the core workflow into detailed HR execution. Distinguish offer sent, accepted/declined, delayed, withdrawn, and confirmed start outcomes. Ambiguous information stays pending.

Start-confirmation batches are grouped by authorized owner and scope. Each candidate appears only to recipients allowed to see that record. Each response creates its own outcome event and reporting update. One unclear item does not block confirmed items in the same batch.

**Confirmed rule A:** once both the unsuccessful candidate outcome and the continuing approved vacancy are verified, WelcomeFlow returns the need to recruiting automatically and assigns the next recruiting action. It does this once for the affected opening/seat. Preserve previous hire and outcome history; reconcile current remaining capacity separately. If the need is closed, cancelled, filled elsewhere, ambiguous, or no longer approved, hold for human review. A returned recruiting need does not authorize an external ATS write or creation of a new requisition.

### S8. Reporting, audit, and support

Derive reports and the leadership quick snapshot from workflow events and their timestamps, using confirmed evidence for completed outcomes. The snapshot aggregates only overdue/escalated work or intervention needs within the leader’s authorized span; no routine scheduled leadership push. Pending, unknown, and failed states remain visible to their authorized workflow owners and do not count as completed outcomes. Record source freshness and missing evidence. A report correction points to the underlying fact or event; it does not create a separate editable version of the truth.

Preserve current reporting periods, stable identities, reconciliation, history and exports. The audit trail answers who did what, when, and why, independently of report generation. Leadership’s quick snapshot identifies an intervention, one accountable owner, and due time without requiring a report-building task. The website supplies any authorized detail needed to act.

Training explains human decisions, normal system motion, and how to resolve exceptions. Practice must remain isolated from real candidate records and messaging. Support uses an explicit escalation owner and permitted access. Per-user progress is a later extension of the approved account model; it is not implemented in the current draft.

#### Locked inactive review, removal, and reporting retention

After 90 days without activity, show a lightweight Inactive Candidate Review card/queue; clients may adjust the threshold. Include candidate name, position, last activity date, and days inactive. Actions are Keep Active or Remove from WelcomeFlow. Do not automatically remove the candidate or interrupt the recruiter with aggressive pop-ups. Routine automated reminders must not disguise a lack of meaningful candidate/workflow activity.

Remove from WelcomeFlow clears the active workspace and stops obsolete queued work. It does not delete or change the client’s ATS record. Inactivity alone is not a decline or withdrawal. Retain the recorded final outcome, or an explicitly unknown outcome, rather than inventing one during removal.

Retain only a lightweight reporting record after the active workflow ends. Candidate name or internal ID; position/requisition; business unit/facility where relevant; recruiter; workflow-entry and final-disposition dates; final outcome and decline/withdrawal reason; whether interview, offer, and hire occurred; and time in process are suitable reporting fields. Keep only necessary minimal event provenance for who recorded or corrected these facts, when, and why. This is not permission to retain a full candidate-history archive.

Do not keep resumes, applications, attachments, lengthy interview notes, credential records, or other heavy applicant data solely for reporting. Those remain in the client’s ATS or designated system. Preserve the ability to answer annual volume, hire, withdrawal, non-response, drop-off, and time-in-process questions from the lightweight record.

Archive retention defaults to three years and is client-adjustable. At expiry, present an admin review; an administrator can approve a simple purge. Do not silently purge. Three years is a product default, not a compliance determination. This policy revision authorizes no current record removal, migration, or purge.

### S9. Acceptance scenarios for the approved build

These are proposed future acceptance tests, not completed test results.

| ID | Scenario | Required observable result |
|---|---|---|
| AC01 | Two recruiters handle comparable cases under one client policy | Same SLA calculation and escalation rules; neither can invent a personal cadence |
| AC02 | Client uses manually verified requisitions and employment outcomes | Workflow operates without a direct integration; source, verifier and time remain visible |
| AC03 | Recruiter approves a valid post-screen packet | One handoff and next action are recorded automatically; no duplicate report entry |
| AC04 | Source or recipient changes after review | Affected action stops and creates one actionable exception; stale approval cannot release it |
| AC05 | An email draft is opened and abandoned | No sent/delivered/completed state is recorded from the opening alone |
| AC06 | Email submission returns an uncertain result | Status remains unknown; recovery checks evidence before any resend |
| AC07 | Manager opens the same decision from email and extension | Both show current website state; repeat submission cannot create duplicate outcomes |
| AC08 | Manager requests a non-owned or inactive requisition, another client’s record, or unrelated candidate/offer/hire information | Access is denied across website lists, search, detail, exports, email actions, and extensions; outgoing email does not disclose out-of-scope information |
| AC09 | Manager does not respond by the client deadline | Escalation reaches one configured accountable owner and retains the original timing |
| AC10 | A calendar link expires or availability changes | Request is preserved; candidate receives a valid next step without a false confirmation |
| AC11 | Start batch spans different managers or locations | Audience partitioning prevents record disclosure; responses are individual and partial completion works |
| AC12 | One start outcome is unknown while other outcomes are confirmed | Unknown item enters review; confirmed items advance independently |
| AC13 | Confirmed withdrawal/no-start leaves a confirmed approved vacancy | Need returns once with assigned recruiting work; history remains intact |
| AC14 | Withdrawal occurs against a cancelled or uncertain need | No automatic reopening; one exception identifies the missing authority or conflict |
| AC15 | Worker, audit, or save operation fails during an action | Work and ownership remain visible; recovery avoids lost actions, duplicate sends and silent overwrites |
| AC16 | Leadership opens the quick snapshot or receives an alert | Sees overdue/escalated items or intervention needs only within their authorized span, with impact, owner, due time, and next action. Healthy pending work creates no alert; no routine daily/weekly summaries are pushed |
| AC17 | A recruiter uses no extension | Proactive email and website support the complete workflow |
| AC18 | Existing records and reports are compared before and after a change | Stable identities, historical outcomes, saved drafts, custom templates and reconciled counts are preserved |
| AC19 | A second industry, including trucking, uses the same loops | Configuration adapts requirements; the core workflow and safeguards stay consistent |
| AC20 | No human uncertainty exists in an approved routine step | System motion completes without asking for another redundant approval |
| AC21 | Manager opens an owned active requisition | Sees its related candidates, pending decisions, offers, and hires; unrelated candidate applications remain inaccessible |
| AC22 | Requisition ownership changes or it becomes inactive | Former manager access and stale quick actions are rejected on the next request; pending communications recheck scope; underlying records and audit history remain intact |
| AC23 | Manager/stage owner chooses Proceed | Initial Proceed starts stage one; later Proceed advances only to the next configured stage after confirmed completion. Candidate selects from supplied slots. Only final required stage completion and a favorable authorized decision permit movement toward offer handoff |
| AC24 | Manager chooses Hold | Candidate receives one active-review note without a decision date; no long explanation or date promise is required |
| AC25 | Manager declines or candidate withdraws | Decline requires a short reason with optional comment; withdrawal remains a distinct outcome with a short candidate reason and reporting record |
| AC26 | Interview is booked within a week | Confirmation, 48-hour preparation, and 24-hour reminder follow the approved timing; shorter notice does not trigger expired, duplicate, or unreasonable catch-up messages |
| AC27 | Offer handoff is assigned/sent to its configured owner | Ownership is established without an acknowledgment task; send failures enter recovery and are not hidden |
| AC28 | Candidate reaches the configured inactivity threshold | Lightweight review shows name, position, last activity, and days inactive with Keep Active/Remove actions; no automatic removal or inferred withdrawal |
| AC29 | Authorized user removes a candidate from WelcomeFlow | Active workspace and obsolete pending work are cleared; ATS is unchanged; only lightweight reporting facts and necessary provenance remain |
| AC30 | Lightweight reporting archive reaches configured retention | Admin review appears before any purge; elapsed retention alone does not delete the record |
| AC31 | Client adjusts SLA settings or a credential validity request arises | Client timing applies consistently without role tiers; no credential/verification-expiry system is added to this phase |
| AC32 | Compare a one-stage CNA plan and a three-stage AVP plan | Both use the same configurable workflow; each follows only its own ordered plan through completion/feedback and a human final decision |
| AC33 | Panel members submit differing feedback | Feedback is recorded for the one stage owner; no panel submission, aggregate score, or majority advances or rejects the candidate |
| AC34 | Owner chooses Proceed after an intermediate interview | The next configured stage receives one correctly scoped task; no offer handoff starts and no required stage is skipped |
| AC35 | Interview end time passes without confirmed completion or a decision | No automatic completion, progression, or hiring judgment; missing evidence remains pending for the accountable owner |
| AC36 | Final required stage is completed and owner records a favorable final decision | Workflow may advance toward configured offer handoff only when required authority/approvals are present; no separate offer-owner acknowledgment task is added |
| AC37 | Stage decision is retried, submitted from two surfaces, or uses a stale owner/plan | One valid transition at most; stale/unauthorized decisions fail safely and preserve history without duplicate communication |
| AC38 | Candidate withdraws, a stage is held/declined, or the plan is incomplete | Obsolete future-stage work stops; Hold preserves the stage without a candidate date promise; an unknown next stage cannot be treated as the final stage |
| AC39 | A panel member or stage owner attempts to browse unrelated requisitions | Only explicitly authorized stage work is available; manager visibility and client boundaries remain enforced |
| AC40 | Interview is scheduled but not confirmed complete | No candidate experience check-in is sent solely because the scheduled end time passed |
| AC41 | Interview completion is confirmed | One check-in is queued for approximately 1–2 hours later by default, subject to client policy, permission, and send window; the message explicitly says it is not an offer or hiring decision |
| AC42 | Candidate responds positively and needs no follow-up | Interest and simple experience response become timestamped stage/reporting events without a recruiter exception or hiring decision |
| AC43 | Candidate reports a poor experience, loss of interest, an unanswered question, or asks for follow-up | One actionable recruiter exception contains the response and next step; a vague loss-of-interest response is not silently treated as confirmed withdrawal |
| AC44 | Authorized manager receives an upcoming-interview reminder | Compact snapshot includes the upcoming interview and permitted same-requisition candidate status/prior feedback; it omits private, unrelated, inactive, and out-of-scope records |
| AC45 | Three candidates under one requisition await the same manager’s feedback | One actionable reminder or escalation presents the due items where possible; each candidate still has its own decision, SLA clock, timestamp, and audit event |
| AC46 | One candidate is resolved or manager ownership changes before a grouped reminder sends | Resolved or unauthorized item is removed; remaining valid items stay actionable without a stale or cross-scope disclosure |
| AC47 | Future recruiter extension captures a reviewed candidate/resume | Capture associates only with an existing authorized requisition, checks identity/duplicates, preserves human review before outreach, and does not become a Phase 1 prerequisite |

## 8. Decision status and final approval gate

Continue from our WelcomeFlow decisions, defaults, and guardrails locked.

CEO-01 through CEO-03 remain closed, and the latest handoff closes CEO-04 as APPROVED WITH REVISION. Do not use earlier unresolved-item lists to reopen these decisions. Manager visibility remains limited to owned active requisitions and related candidates, pending decisions, offers, and hires. Client-designated sources, consistent client-adjustable SLAs, one accountable escalation owner, and all other locked decisions remain in force.

| ID | Status | Recorded decision |
|---|---|---|
| CEO-01: SLA, reminders, and escalation | **Closed** | 7:00 AM–6:30 PM default send window; explicit recipient-local instruction retained with the longer handoff’s timezone caveat surfaced in section 5.2. Booking confirmation plus 48-hour prep and 24-hour reminder when reasonable. Client-adjustable SLAs, no role tiers, no offer acknowledgment step, and exception-only leadership snapshot/alerts with no routine summary pushes. |
| CEO-02: Manager candidate decisions | **Closed; extended by CEO-04** | Proceed follows the configured Interview Plan, initially using manager-supplied slots; Hold sends active-review language with no decision date; Decline requires a short reason and optional comment. Withdrawn / No Longer Interested is distinct. Preserve the deferred Phase 2 direct-calendar/manual-slot modes and alternative-availability loop. |
| CEO-03: Inactivity, retention, and verification | **Closed** | Configurable 90-day inactive review with Keep Active/Remove actions; removal clears active workspace but leaves the ATS untouched. Keep a lightweight reporting record only, default three-year configurable retention, and admin review before purge. Verification/credential validity is out of scope. |
| CEO-04: Implementation sequence | **APPROVED WITH REVISION / Closed** | Begin with permissions, reliable shared events, exception handling, and failure recovery. First workflow: post-screen handoff → manager decision → interview scheduling → interview completion/feedback → next configured stage or final hiring decision. Include one or multiple stages, one owner per stage, and supporting panel feedback. Preserve the Phase 2 scheduling enhancement. |
| Final specification approval | **Awaiting CEO approval** | Review and approve revision 5 before coding. CEO-04 approves the revised sequence and scope; the CEO explicitly requested a separate final specification review before implementation. Revision 5 adds the candidate check-in, contextual/consolidated manager communications, and future extension capture without changing that sequence. |

**Next approval:** this final Revision 5 specification, including the multi-stage workflow and candidate/manager communication loops in section S4 and acceptance scenarios in S9. Do not ask again whether this workflow should be the first implementation priority. That choice is closed. No application changes, rebuild, deletion, deployment, or operational messaging are authorized by this document revision.


Detailed implementation proposals such as internal SLA-clock mechanics and start-outcome vocabulary remain part of the final specification review, not reopened versions of CEO-01 through CEO-04. If implementing a selected workflow exposes a genuine unresolved edge case, raise that one material decision with an example. Do not silently invent a short-notice reminder gap, an exception to the send window, or a replacement timezone. The exact decline-reason taxonomy can be refined later, as directed.

Named owners, requisition ownership, leadership span, source names, operating calendars, and permitted contact channels are client setup values within the standard. No arbitrary role tiers or universal timing bounds are added. Retry mechanics must implement the locked recovery rules. Direct integration, verification-validity features, and detailed ATS/credentialing functionality are not prerequisites for this specification or initial operation.

**Approval gate:** review this audit and specification first. Application changes begin only after the CEO explicitly approves the specification. Such approval authorizes the agreed implementation scope; production release remains a separate decision after validation. No application code, deletions, rebuilds, external communications, or deployments are part of this document revision.

## 9. Evidence index

References below point to the inspected draft commit. Most foundations predate PR #15; industry setup, enablement, and related mobile changes remain draft additions. Source presence is not deployment verification.

| Ref | Source and relevant evidence |
|---|---|
| E1 | [App.js](https://github.com/ashleysimpson0218-hash/Submission-assistant/blob/00c52abdd87cda481a6ec70165e1df98c48e044f/src/App.js): status/owner map around 1182; save paths 1409; outreach 9279–9444; history 9993; workflow updates 11521; manager follow-up 12804; bulk starts 12870; onboarding completion 13029–13110; reporting settings 14139 and 17167. |
| E2 | [candidateReadyConfirmation.js](https://github.com/ashleysimpson0218-hash/Submission-assistant/blob/00c52abdd87cda481a6ec70165e1df98c48e044f/src/candidateReadyConfirmation.js), candidateReadyPackageValidation.js, communicationGeneration.js: scoped validation, fingerprints, stale review, identity and duplicate protections. |
| E3 | [actionCenterSelectors.js](https://github.com/ashleysimpson0218-hash/Submission-assistant/blob/00c52abdd87cda481a6ec70165e1df98c48e044f/src/actionCenterSelectors.js): read-only derived actions, readiness, manager feedback and context. |
| E4 | [RecruiterWorkspacePage.js](https://github.com/ashleysimpson0218-hash/Submission-assistant/blob/00c52abdd87cda481a6ec70165e1df98c48e044f/src/RecruiterWorkspacePage.js), recruiterWorkspaceSelectors.js and workPagePresentation.js: existing Work sections and heuristic owner resolution. |
| E5 | [submissionCommunicationActions.js](https://github.com/ashleysimpson0218-hash/Submission-assistant/blob/00c52abdd87cda481a6ec70165e1df98c48e044f/src/submissionCommunicationActions.js), actionCenterCommunicationActions.js: distinct copy/open/send-confirmation states and context revalidation. |
| E6 | [send-email.js](https://github.com/ashleysimpson0218-hash/Submission-assistant/blob/00c52abdd87cda481a6ec70165e1df98c48e044f/api/send-email.js): recipient restrictions, gated provider request, and errors; no durable delivery recovery path in this handler. |
| E7 | [welcomeflowApiSecurity.js](https://github.com/ashleysimpson0218-hash/Submission-assistant/blob/00c52abdd87cda481a6ec70165e1df98c48e044f/server/welcomeflowApiSecurity.js), communicationWorkflow.js: API role/workspace authorization and configurable channel modes. |
| E8 | [book-screening.js](https://github.com/ashleysimpson0218-hash/Submission-assistant/blob/00c52abdd87cda481a6ec70165e1df98c48e044f/api/book-screening.js), internalCalendar.js and the slot-reservation migration: requested/confirmed distinction, scoped tokens, concurrency and internal-only calendar state. |
| E9 | [workflowLogic.js](https://github.com/ashleysimpson0218-hash/Submission-assistant/blob/00c52abdd87cda481a6ec70165e1df98c48e044f/src/workflowLogic.js): hire records, fill counts, onboarding and withdrawal patches. |
| E10 | [weeklyReportingWorkflow.js](https://github.com/ashleysimpson0218-hash/Submission-assistant/blob/00c52abdd87cda481a6ec70165e1df98c48e044f/src/weeklyReportingWorkflow.js), weeklyCleanupReporting.js, noOpeningFacilityPolicy.js: derived reporting and manual review flow. |
| E11 | [Communication audit migration](https://github.com/ashleysimpson0218-hash/Submission-assistant/blob/00c52abdd87cda481a6ec70165e1df98c48e044f/supabase/migrations/20260826015254_add_communication_action_audit.sql), record-communication-action.js: actor, timestamps, duplicate prevention and constrained action types. |
| E12 | [runtimeConfig.js](https://github.com/ashleysimpson0218-hash/Submission-assistant/blob/00c52abdd87cda481a6ec70165e1df98c48e044f/src/runtimeConfig.js), OwnerUatAuthGate.js and database migrations: environment boundaries and owner testing. Live policy installation was not inspected. |
| E13 | [vercel.json](https://github.com/ashleysimpson0218-hash/Submission-assistant/blob/00c52abdd87cda481a6ec70165e1df98c48e044f/vercel.json), package.json, public/manifest.json and repository inventory: web application structure; no extension/background automation service found in inspected paths. |
| E14 | [communicationDraftCloudSave.js](https://github.com/ashleysimpson0218-hash/Submission-assistant/blob/00c52abdd87cda481a6ec70165e1df98c48e044f/src/communicationDraftCloudSave.js): version checks and preservation for communication drafts; not proof of general multi-user reconciliation. |
| E15 | [Draft release scope](https://github.com/ashleysimpson0218-hash/Submission-assistant/blob/00c52abdd87cda481a6ec70165e1df98c48e044f/docs/recruiter-experience-release.md), industryProfiles.js, industryCommunicationTemplates.js, RecruiterEnablementPage.js: additive industry setup, preserved templates, session-only training and known rollout limits. |

## Final disposition

Preserve the current build and draft #15. Align the operating rules before implementation. Prioritize permissions, reliable events, accurate completion states, and exception recovery; then automate the existing loops and expose the same work through email and extensions.

The standard is met when recruiters spend their attention on people and decisions, and routine system work moves reliably without repeated administration.
