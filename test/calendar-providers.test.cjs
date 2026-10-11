const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createCalendarProvider } = require('../server/workflow/calendarProviders');
const start = '2026-10-12T14:00:00Z', end = '2026-10-12T14:30:00Z';
const booking = { bookingId: 'persisted-booking-1', start, end, subject: 'Interview',
  location: 'Facility office', instructions: 'Bring your questions.', attendeeEmails: ['candidate@example.com'] };
function setup(provider, replies) {
  const calls = [], tokens = [];
  const client = createCalendarProvider({ provider, workspaceId: 'workspace-1', userId: 'leader-1',
    connectorId: 'trusted-connector', calendarId: 'primary', email: 'leader@example.com' }, {
    getToken: async (...args) => { tokens.push(args); return 'private-token'; },
    fetch: async (url, options) => {
      calls.push({ url, ...options, body: options.body && JSON.parse(options.body) });
      const reply = replies.shift();
      if (reply instanceof Error) throw reply;
      if (!reply) throw new Error('Unexpected call');
      return { status: reply.status || 200, ok: !reply.status || reply.status < 300, json: async () => reply.body };
    },
  });
  return { client, calls, tokens };
}
const googleFree = { body: { calendars: { primary: { busy: [] } } } };
const outlookFree = { body: { value: [] } };

test('Google creates an invited event on the scoped calendar after checking availability', async () => {
  const { client, calls, tokens } = setup('google', [{ status: 404 }, googleFree, { body: { id: 'event-1' } }]);
  assert.equal((await client.createEvent(booking)).eventId, 'event-1');
  assert.equal(calls[1].url, 'https://www.googleapis.com/calendar/v3/freeBusy');
  assert.match(calls[2].url, /calendars\/primary\/events\?sendUpdates=all$/);
  assert.match(calls[2].body.id, /^[0-9a-f]{64}$/);
  assert.deepEqual(calls[2].body.attendees, [{ email: 'candidate@example.com' }]);
  assert.deepEqual(tokens[0][1].subject, { type: 'user', id: 'leader-1' });
});
test('Outlook uses calendarView for personal and organization accounts with a stable transaction ID', async () => {
  const a = setup('microsoft', [outlookFree, { body: { id: 'event-2' } }]);
  await a.client.createEvent(booking);
  assert.match(a.calls[0].url, /^https:\/\/graph.microsoft.com\/v1.0\/me\/calendar\/calendarView\?/);
  assert.equal(a.calls[0].method, 'GET');
  assert.equal(a.calls[0].headers.Prefer, 'outlook.timezone="UTC"');
  assert.equal(a.calls[1].body.start.timeZone, 'UTC');
  assert.equal(a.calls[1].body.attendees[0].emailAddress.address, 'candidate@example.com');
  const b = setup('microsoft', [outlookFree, { body: { id: 'event-2' } }]);
  await b.client.createEvent(booking);
  assert.equal(a.calls[1].body.transactionId, b.calls[1].body.transactionId);
});
test('busy or out-of-office Outlook time prevents an event write', async () => {
  const { client, calls } = setup('microsoft', [{ body: { value: [{ showAs: 'oof',
    start: { dateTime: '2026-10-12T14:00:00', timeZone: 'UTC' },
    end: { dateTime: '2026-10-12T15:00:00', timeZone: 'UTC' } }] } }]);
  await assert.rejects(client.createEvent(booking), { code: 'CALENDAR_SLOT_UNAVAILABLE' });
  assert.equal(calls.length, 1);
});
test('partial free/busy errors never become free time', async () => {
  for (const provider of ['google', 'microsoft']) {
    const body = provider === 'google' ? { calendars: { primary: { errors: [{ reason: 'notFound' }], busy: [] } } }
      : { error: { message: 'denied' } };
    const { client } = setup(provider, [{ body }]);
    await assert.rejects(client.busy(start, end), { code: 'CALENDAR_UNAVAILABLE' });
  }
});
test('timezone-less intervals are rejected before any credential or network request', async () => {
  const { client, calls, tokens } = setup('google', []);
  await assert.rejects(client.busy('2026-10-12T14:00:00', end), { code: 'INVALID_CALENDAR_INTERVAL' });
  assert.equal(calls.length + tokens.length, 0);
});
test('provider authorization errors are sanitized', async () => {
  const { client } = setup('google', [{ status: 403, body: { message: 'secret-token' } }]);
  await assert.rejects(client.busy(start, end), error => error.code === 'CALENDAR_AUTHORIZATION_REQUIRED' && !error.message.includes('secret'));
});
test('uncertain event writes are not retried or reported as confirmed', async () => {
  const { client, calls } = setup('microsoft', [outlookFree, new Error('network secret')]);
  await assert.rejects(client.createEvent(booking), { code: 'CALENDAR_WRITE_UNKNOWN' });
  assert.equal(calls.length, 2);
});
test('Google safely reuses an identical recorded event without writing twice', async () => {
  const first = setup('google', [{ status: 404 }, googleFree, { body: { id: 'event-1' } }]);
  await first.client.createEvent(booking);
  const body = { ...first.calls[2].body };
  const retry = setup('google', [{ body }]);
  assert.equal((await retry.client.createEvent(booking)).reused, true);
  assert.equal(retry.calls.length, 1);
  const changed = setup('google', [{ body }]);
  await assert.rejects(changed.client.createEvent({ ...booking, location: 'Changed' }), { code: 'CALENDAR_RECONCILIATION_REQUIRED' });
});
test('missing trusted binding and unsupported Outlook calendars fail closed', () => {
  assert.throws(() => createCalendarProvider({ provider: 'google' }), { code: 'CALENDAR_CONNECTION_REQUIRED' });
  assert.throws(() => createCalendarProvider({ provider: 'microsoft', workspaceId: 'w', userId: 'u', connectorId: 'c', calendarId: 'other' }), { code: 'UNSUPPORTED_CALENDAR' });
});
test('Outlook consumes every page and catches a busy event on a later page', async () => {
  const later = 'https://graph.microsoft.com/v1.0/me/calendar/calendarView?$skiptoken=next';
  const { client, calls } = setup('microsoft', [{ body: { value: [], '@odata.nextLink': later } },
    { body: { value: [{ showAs: 'tentative', start: { dateTime: '2026-10-12T14:00:00', timeZone: 'UTC' },
      end: { dateTime: '2026-10-12T14:30:00', timeZone: 'UTC' } }] } }]);
  await assert.rejects(client.createEvent(booking), { code: 'CALENDAR_SLOT_UNAVAILABLE' });
  assert.equal(calls.length, 2);
});
test('Outlook rejects foreign pagination links before forwarding credentials', async () => {
  const { client, calls } = setup('microsoft', [{ body: { value: [], '@odata.nextLink': 'https://untrusted.example.com/events' } }]);
  await assert.rejects(client.busy(start, end), { code: 'CALENDAR_UNAVAILABLE' });
  assert.equal(calls.length, 1);
});
test('Outlook excludes cancelled/free events and conservatively blocks unknown availability', async () => {
  const event = { start: { dateTime: '2026-10-12T14:00:00', timeZone: 'UTC' },
    end: { dateTime: '2026-10-12T14:30:00', timeZone: 'UTC' } };
  const { client } = setup('microsoft', [{ body: { value: [
    {...event, showAs: 'free'}, {...event, showAs: 'busy', isCancelled: true}, {...event, showAs: 'unknown'},
  ] } }]);
  assert.equal((await client.busy(start, end)).length, 1);
});
