# Outlook and Google leadership scheduling

Approved provider scope: Microsoft 365 / Outlook and Google Calendar. The facility's assigned leadership account determines the provider; candidates use the same WelcomeFlow scheduling experience. The manual manager-times option remains available.

## Source prepared

`server/workflow/calendarProviders.js` supplies server-only free/busy and invited-event adapters for both providers. It requests short-lived user-scoped tokens through Vercel Connect. Binding values must come from trusted workspace/member records, never candidate or browser input. No refresh tokens belong in the browser or workflow snapshots.

Google supports the approved calendar ID. Outlook currently supports the connected leadership account's primary calendar, not shared/delegated calendars. Microsoft uses UTC schedule results and a stable transaction ID. Google uses a stable event ID and payload fingerprint to detect identical retries. Partial availability errors fail closed. Network uncertainty on event creation requires reconciliation before confirmation; no blind retries occur.

These adapters are prepared source, **not an activated calendar workflow**. The existing direct-calendar Proceed guard remains in place. The API and candidate UI are not connected to these adapters yet, and no live booking or email has been sent by this change.

## Activation requirements

1. Obtain Vercel Connect management access, create/discover separate preview Google and Microsoft connectors, and attach them to the test project/environment. Connector listing returned HTTP 403 in this session; no Vercel CLI credentials are available as a fallback.
2. Implement the authenticated account-consent/settings flow. Derive user subjects from the server session; persist provider account/calendar bindings scoped to the workspace and authorized leadership member. Confirm mailbox identity and account access before accepting a binding. Provide disconnect/reconnect behavior.
3. Configure approved interview duration, leadership working hours, timezone, location and preparation instructions. Generate candidate-visible slots from intersections of all required participants' availability and internal reservations.
4. Wire Proceed to availability-backed invitation. Persist durable booking intent before provider writes; serialize internal reservations; recheck required calendars immediately before writing. Reconcile unknown writes and record provider event IDs before reporting confirmation. External calendars can change concurrently; availability checks alone are not an atomic reservation.
5. Connect cancellation/rescheduling and revoked-account handling. Outlook uncertain writes need event reconciliation; a repeated create request is not sufficient acceptance evidence.
6. Verify both providers on the nonproduction deployment: manager email -> authenticated decision -> candidate invitation -> slot choice -> actual leadership event -> confirmation and recruiter visibility. Test conflicts, duplicate clicks, timezone changes and revoked access. Release approval remains separate.

## Official references

- Vercel Connect SDK: https://vercel.com/docs/connect/ts-sdk-reference
- Google free/busy: https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query
- Google event insert: https://developers.google.com/workspace/calendar/api/v3/reference/events/insert
- Microsoft getSchedule: https://learn.microsoft.com/en-us/graph/api/calendar-getschedule?view=graph-rest-1.0
- Microsoft event create: https://learn.microsoft.com/en-us/graph/api/user-post-events?view=graph-rest-1.0

## Validation

Run `node --test test/calendar-providers.test.cjs test/workflow-foundation.test.cjs` and `CI=true npm run build`. Provider adapter tests use isolated fake HTTP responses; they do not prove real consent, delivery or calendar writes.

Results: 36 tests passed, lint passed, production build compiled successfully, and the SDK's server import was verified. Install with `npm ci --legacy-peer-deps`: the SDK's unused optional Better Auth adapter otherwise pulls a newer TypeScript peer that conflicts with Create React App's TypeScript 4 peer. The dry-run clean install with this flag passed. Configure the test project's install command before deployment; do not silently change production project settings.
