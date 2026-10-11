# Manager submission automation correction

October 9, 2026. User feedback: the received Jane Doe submission only asked the manager to reply and contained no WelcomeFlow decisions. Its Outlook reply suggestions were not WelcomeFlow actions.

## Findings

The saved facility submission opens a manual email draft. The Revision 5 workflow handoff is a separate, opt-in action. Even the workflow worker's decision email had only a general portal link. Therefore the received submission did not demonstrate the intended automatic handoff. Local regression results and a READY deployment did not establish connected acceptance of this experience.

## Required behavior and implementation

- The existing reviewed Submission Communications panel now offers **Send submission with manager actions**, using the server-authorized saved candidate, requisition and manager. It records the handoff and requests case-scoped processing. Unknown transport outcomes retain the same command for reconciliation.
- The manager email includes the reviewed packet and candidate-specific HTML and plain-text links: **Proceed**, **Proceed but select your time your way**, **Hold for other candidate review**, and **Decline to proceed**. Links open the authorized candidate's action form. Opening a link cannot record a decision, preventing mail-link scanning from changing a candidate. Old-version links require current review.
- Manager-selected times use one atomic Proceed-and-slots command. Invalid times do not record Proceed. Valid offered times queue the scoped candidate invitation without another request to the same manager to provide times.
- Hold queues an upbeat active-review email without implying selection or promising a date. Candidate email Reply-To is the active recruiter, not the manager. Held cases do not continue manager-decision reminders.
- Decline requires a short reason and optional manager comment, creates recruiter-owned follow-up work, and queues the internal decision notification to recruiting. Only recruiting chooses WelcomeFlow candidate follow-up or company ATS handling. The candidate message does not expose internal manager reasons/comments. ATS handling records manual work and an ATS-ready note; there is no external ATS write.
- Workflow action processing now sends HTML and explicit recruiter Reply-To and reads the current post-processing state for UI status. Case-scoped processing does not send unrelated candidates' pending messages.

## Unresolved direct-calendar dependency

The user's October 9 instruction promotes leadership-calendar booking from the earlier deferred scope into the requested manager flow. The current application has no connected leadership-calendar provider, OAuth/calendar selection, external free/busy checks, or calendar event creation/confirmation path. Calendar Proceed therefore fails clearly before any candidate transition or scheduling email. It cannot pretend to reserve a calendar time or silently substitute manual times.

Required next input: which calendar provider the leadership calendars use (Microsoft 365/Outlook, Google Calendar, or both), followed by the actual authorized calendar connection and selection. Calendar acceptance must prove availability, event creation, conflict handling, candidate confirmation and recovery against that provider. No production deployment or calendar connection is authorized by these local changes.

## Validation

- 27 workflow/domain checks passed, including action links, HTML escaping, compound scheduling rollback, recruiter reply routing, decline ownership and ATS isolation.
- Protected API and manager/candidate UI checks passed, including link-open without POST, stale-link review, one-command offered times, and case-scoped post-handoff processing.
- Build and ESLint passed. The full regression run found a pre-existing public-document privacy scan failure. Personal identifiers and test mailbox addresses were removed from three existing public checkpoint documents; exact runtime recipient settings were not modified. The affected privacy scan was rerun with the final UI/API checks.
- Full regression run: 1,031 passed and one pre-existing privacy scan failed. After correcting the documents, the privacy scan and final UI/API checks passed; 1,034 distinct regression checks were covered across the combined runs.
- The updated browser acceptance harness could not run: Chromium was absent and the download failed. No new browser screenshots or browser acceptance pass are claimed.
- No test messages were sent during local validation. Connected end-to-end acceptance, provider delivery and calendar booking remain unverified.
