# Connected Calendar Invitation Checkpoint

Candidate selection of a manager-provided interview time persists a calendar-sync intent before any provider write. WelcomeFlow then creates an event in the verified stage owner Outlook calendar and includes the candidate plus assigned interviewers as attendees. The provider event identifier is saved when creation succeeds.

An uncertain provider write is not repeated. The manager control checks the connected calendar for the stable transaction before another write can occur. Failed and uncertain results remain visible in WelcomeFlow for authorized recovery.

The candidate confirmation email includes an iCalendar attachment and explicit Google Calendar and Outlook Calendar links. These are fallback calendar-saving controls and do not replace the connected Outlook event status shown in WelcomeFlow. Existing scheduled records that predate this update display a calendar-attention control so an authorized stage owner or recruiter can create or reconcile the invitation.
