# Outlook and Google leadership scheduling

Approved provider scope: Microsoft 365 / Outlook and Google Calendar. The facility's assigned leadership account determines the provider; candidates use the same WelcomeFlow scheduling experience. The manual manager-times option remains available.

## Current preview connection

The Microsoft connector `microsoft/welcomeflow-preview` is saved and attached to `welcomeflow-revision5-test` for Preview only. Its Entra app supports organizational and personal accounts with authority `common`. The dashboard authorization test issued a token and showed a refresh token; the selected test scopes were User.Read and Calendars.ReadWrite. This does not establish a grant for an application user or prove a calendar API call.

The authenticated `/api/calendar` route and **Outlook calendar connection test** section now provide the application-owned connection flow:

- The Connect subject is derived server-side from database project, workspace and authenticated user. Dashboard example identities and client-supplied identities are never used.
- The server verifies Microsoft profile and writable primary calendar before persisting the account binding in the existing workflow store. Only active members of an allowlisted workspace can use the route.
- Availability returns busy intervals without event subjects or descriptions. Each operation verifies that the provider identity still matches the saved binding.
- A 15-minute, clearly labeled test appointment has no invitees or reminders. Its durable intent and reservation commit through the existing serializing workflow RPC before Outlook is contacted. Replayed requests only reconcile; they never issue another create. The UI reports confirmed only after reading the matching transaction back from Outlook.
- Test history is restricted to its owner. Unknown writes remain reserved and require reconciliation. A changed or deleted event is not permission to blindly recreate it. The preview permits at most 20 test requests per member.
- Disconnect removes the app binding; it does not revoke Microsoft's underlying consent. Pending writes must be reconciled before disconnecting. Test appointments can be removed manually from Outlook after verification.

The test appointment write also honors `WELCOMEFLOW_UAT_EXTERNAL_ACTIONS_DISABLED`. Preview now has that switch set to false for requested calendar testing; email, resume and screening-booking flags were verified false.

The test endpoint is disabled outside Vercel Preview and an isolated test/acceptance/preview database runtime. It reuses the existing database schema and workflow feature/runtime gates. No new secret environment variables are needed. `@vercel/connect` uses the deployment OIDC token. The connector UID is pinned to the preview connector.

## Running the Outlook connector test

1. Open the test deployment's `/workflow` page and sign in with an active test workspace member.
2. Expand **Outlook calendar connection test**. Select **Connect Outlook**, follow **Continue to Microsoft**, and complete the app user's authorization.
3. Return and select **Verify connected calendar**. Confirm the displayed mailbox is the intended Outlook account.
4. Choose a future start in the explicitly displayed browser timezone. Check the time, then create the 15-minute test appointment.
5. Confirm **Confirmed in Outlook** and independently inspect Outlook. Use **Check saved test appointment** after an interrupted response. No candidate invitation is sent by this test.

## Remaining interview scheduling work

The existing direct-calendar Proceed guard remains in place. The connector test does not activate candidate interview scheduling. Full release still requires approved leadership working hours, duration/location/preparation, required-participant slot generation, durable candidate booking/reconciliation, cancellations/rescheduling, candidate email confirmation and recruiter visibility. Google adapters exist but the Google connector and app consent flow are not activated. Both providers require live acceptance before release. Production approval remains separate.

## Official references

- Vercel Connect SDK: https://vercel.com/docs/connect/ts-sdk-reference
- Google free/busy: https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query
- Google event insert: https://developers.google.com/workspace/calendar/api/v3/reference/events/insert
- Microsoft calendarView: https://learn.microsoft.com/en-us/graph/api/user-list-calendarview?view=graph-rest-1.0
- Microsoft account audiences: https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc
- Microsoft event create: https://learn.microsoft.com/en-us/graph/api/user-post-events?view=graph-rest-1.0

## Validation

Run `node --test test/calendar-connection.test.cjs test/calendar-providers.test.cjs test/workflow-foundation.test.cjs`, the calendar/workflow API and WorkflowPanel Jest tests, lint, and `CI=true npm run build`.

October 11 UTC: 48 server/domain/provider tests and 20 API/UI tests passed; lint and build passed. Tests cover durable intent before writes, concurrent duplicates, uncertain-write reconciliation, account changes, overlapping reservations, preview/runtime/auth isolation, sanitized errors, and no test invitees. Provider tests use fake HTTP; these results do not prove live calendar access. The local optional canvas package lacked a native binary and was moved aside for jsdom's supported no-canvas mode; no dependency manifest or lockfile changed.

Install with `npm ci --legacy-peer-deps` to avoid the unused Better Auth adapter's optional TypeScript peer conflict with Create React App. Production project settings are unchanged.
