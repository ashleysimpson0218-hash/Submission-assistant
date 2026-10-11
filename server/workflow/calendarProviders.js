// Server-only provider boundary. Never pass credentials or provider errors to the browser.
const { createHash } = require('node:crypto');
const GOOGLE = 'https://www.googleapis.com/calendar/v3';
const GRAPH = 'https://graph.microsoft.com/v1.0';
const SCOPES = Object.freeze({
  google: ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.freebusy'],
  microsoft: ['User.Read', 'Calendars.ReadWrite'],
});

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}
function interval(start, end) {
  const explicit = x => typeof x === 'string' && /(Z|[+-]\d{2}:\d{2})$/.test(x);
  if (!explicit(start) || !explicit(end) || !Number.isFinite(Date.parse(start)) ||
      !Number.isFinite(Date.parse(end)) || Date.parse(end) <= Date.parse(start))
    fail('INVALID_CALENDAR_INTERVAL', 'Provide an interview interval with an explicit timezone.');
  return { start: new Date(start).toISOString(), end: new Date(end).toISOString() };
}
function graphTime(value) {
  if (value?.timeZone !== 'UTC' || typeof value.dateTime !== 'string')
    fail('CALENDAR_UNAVAILABLE', 'Calendar availability could not be verified.');
  return /Z$/.test(value.dateTime) ? value.dateTime : `${value.dateTime}Z`;
}
function graphDate(date) { return { dateTime: date.slice(0, -1), timeZone: 'UTC' }; }

/** binding must come from a trusted server record, scoped to workspace and member.
 * This adapter is intentionally not activated by the workflow API until durable
 * booking intent/reconciliation and account-consent acceptance checks are wired.
 */
function createCalendarProvider(binding, dependencies = {}) {
  if (!binding || !SCOPES[binding.provider] || !binding.connectorId ||
      !binding.userId || !binding.workspaceId || !binding.calendarId)
    fail('CALENDAR_CONNECTION_REQUIRED', 'Connect an approved leadership calendar first.');
  if (binding.provider === 'microsoft' && binding.calendarId !== 'primary')
    fail('UNSUPPORTED_CALENDAR', 'Outlook scheduling currently requires the connected account’s primary calendar.');
  if (binding.provider === 'microsoft' && !binding.email)
    fail('CALENDAR_CONNECTION_REQUIRED', 'The connected leadership mailbox must be verified.');
  const fetcher = dependencies.fetch || global.fetch;
  const tokenProvider = dependencies.getToken || (async (...args) => (await import('@vercel/connect')).getToken(...args));
  async function request(url, method = 'GET', body) {
    let token;
    try {
      token = await tokenProvider(binding.connectorId, {
        subject: { type: 'user', id: binding.userId },
        scopes: SCOPES[binding.provider],
        ...(binding.installationId ? { installationId: binding.installationId } : {}),
      });
    } catch (_) {
      fail('CALENDAR_AUTHORIZATION_REQUIRED', 'The leadership calendar needs authorization.');
    }
    let response;
    try {
      response = await fetcher(url, {
        method, redirect: 'error', signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
          ...(binding.provider === 'microsoft' ? { Prefer: 'outlook.timezone="UTC"' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch (_) {
      fail(method === 'GET' || url.endsWith('/freeBusy') || url.endsWith('/getSchedule')
        ? 'CALENDAR_UNAVAILABLE' : 'CALENDAR_WRITE_UNKNOWN',
      'Calendar request did not complete. Reconcile its outcome before retrying a booking.');
    }
    if ([401, 403].includes(response.status))
      fail('CALENDAR_AUTHORIZATION_REQUIRED', 'The leadership calendar needs authorization.');
    if (response.status === 404) return { missing: true };
    if (response.status === 409) return { conflict: true };
    if (!response.ok)
      fail(method === 'POST' && !url.endsWith('/freeBusy') && !url.endsWith('/getSchedule')
        ? 'CALENDAR_WRITE_UNKNOWN' : 'CALENDAR_UNAVAILABLE', 'Calendar request could not be verified.');
    try { return await response.json(); }
    catch (_) { fail(method === 'POST' && !url.endsWith('/freeBusy') && !url.endsWith('/getSchedule')
      ? 'CALENDAR_WRITE_UNKNOWN' : 'CALENDAR_UNAVAILABLE', 'Calendar response could not be verified.'); }
  }
  const eventsUrl = binding.provider === 'google'
    ? `${GOOGLE}/calendars/${encodeURIComponent(binding.calendarId)}/events` : `${GRAPH}/me/events`;

  async function busy(start, end) {
    const range = interval(start, end);
    if (Date.parse(range.end) - Date.parse(range.start) > 30 * 86400000)
      fail('INVALID_CALENDAR_INTERVAL', 'Check no more than 30 days of availability at once.');
    let rows;
    if (binding.provider === 'google') {
      const data = await request(`${GOOGLE}/freeBusy`, 'POST', {
        timeMin: range.start, timeMax: range.end, timeZone: 'UTC', items: [{ id: binding.calendarId }],
      });
      const result = data.calendars?.[binding.calendarId];
      if (!result || result.errors?.length || !Array.isArray(result.busy))
        fail('CALENDAR_UNAVAILABLE', 'Calendar availability could not be verified.');
      rows = result.busy;
    } else {
      // getSchedule excludes personal Microsoft accounts. Read only this
      // authorized account's calendarView instead, including recurring instances.
      const query = new URLSearchParams({ startDateTime: range.start, endDateTime: range.end,
        '$select': 'start,end,showAs,isCancelled', '$top': '100' });
      let next = `${GRAPH}/me/calendar/calendarView?${query}`, pages = 0;
      rows = [];
      const seen = new Set();
      while (next) {
        const url = new URL(next);
        if (url.origin !== 'https://graph.microsoft.com' ||
            url.pathname !== '/v1.0/me/calendar/calendarView' ||
            seen.has(next) || ++pages > 100)
          fail('CALENDAR_UNAVAILABLE', 'Calendar availability could not be fully verified.');
        seen.add(next);
        const data = await request(next);
        if (!Array.isArray(data.value))
          fail('CALENDAR_UNAVAILABLE', 'Calendar availability could not be verified.');
        rows.push(...data.value.filter(x => !x.isCancelled && x.showAs !== 'free').map(x => ({
          start: graphTime(x.start), end: graphTime(x.end),
        })));
        next = data['@odata.nextLink'];
        if (next !== undefined && typeof next !== 'string')
          fail('CALENDAR_UNAVAILABLE', 'Calendar availability could not be fully verified.');
      }
    }
    return rows.map(x => interval(x.start, x.end));
  }

  async function createEvent(booking) {
    // Caller must persist this exact payload and bookingId before any write.
    const range = interval(booking.start, booking.end);
    if (!booking.bookingId || !booking.subject || !booking.location || !booking.instructions ||
        !Array.isArray(booking.attendeeEmails) || !booking.attendeeEmails.length ||
        booking.attendeeEmails.some(x => typeof x !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)))
      fail('INVALID_CALENDAR_BOOKING', 'Provide reviewed interview details and attendees.');
    const attendees = [...new Set(booking.attendeeEmails.map(x => x.toLowerCase()))].sort();
    const identity = { workspaceId: binding.workspaceId, userId: binding.userId,
      provider: binding.provider, calendarId: binding.calendarId, bookingId: booking.bookingId };
    const id = createHash('sha256').update(JSON.stringify(identity)).digest('hex');
    const fingerprint = createHash('sha256').update(JSON.stringify({ ...range, attendees,
      subject: booking.subject, location: booking.location, instructions: booking.instructions })).digest('hex');
    let existing;
    if (binding.provider === 'google') {
      existing = await request(`${eventsUrl}/${id}`);
      if (!existing.missing) {
        if (existing.extendedProperties?.private?.welcomeflowFingerprint !== fingerprint || existing.status === 'cancelled')
          fail('CALENDAR_RECONCILIATION_REQUIRED', 'The existing booking needs review before retrying.');
        return { provider: binding.provider, eventId: existing.id, reused: true };
      }
    }
    const blocks = await busy(range.start, range.end);
    if (blocks.some(x => Date.parse(x.start) < Date.parse(range.end) && Date.parse(x.end) > Date.parse(range.start)))
      fail('CALENDAR_SLOT_UNAVAILABLE', 'This time is no longer available. Choose another interview time.');
    const body = binding.provider === 'google' ? {
      id, summary: booking.subject, description: booking.instructions, location: booking.location,
      start: { dateTime: range.start }, end: { dateTime: range.end },
      attendees: attendees.map(email => ({ email })),
      extendedProperties: { private: { welcomeflowFingerprint: fingerprint } },
    } : {
      transactionId: id, subject: booking.subject,
      body: { contentType: 'text', content: booking.instructions },
      location: { displayName: booking.location }, start: graphDate(range.start), end: graphDate(range.end),
      attendees: attendees.map(address => ({ emailAddress: { address }, type: 'required' })),
      allowNewTimeProposals: false,
    };
    const result = await request(binding.provider === 'google' ? `${eventsUrl}?sendUpdates=all` : eventsUrl, 'POST', body);
    if (result.conflict || !result.id)
      fail('CALENDAR_RECONCILIATION_REQUIRED', 'Verify the provider booking before sending a confirmation.');
    return { provider: binding.provider, eventId: result.id, reused: false };
  }
  async function inspectAccount() {
    if (binding.provider !== 'microsoft') fail('UNSUPPORTED_CALENDAR', 'Use Outlook for this connection test.');
    const profile = await request(`${GRAPH}/me?$select=id,mail,userPrincipalName`);
    const calendar = await request(`${GRAPH}/me/calendar?$select=id,canEdit,owner`);
    const email = profile.mail || profile.userPrincipalName;
    if (!profile.id || !email || !calendar.id || calendar.canEdit !== true)
      fail('CALENDAR_CONNECTION_REQUIRED', 'A writable Outlook calendar could not be verified.');
    return { accountId: profile.id, email, providerCalendarId: calendar.id };
  }
  const testId = booking => createHash('sha256').update(JSON.stringify([
    binding.workspaceId, binding.userId, booking.id,
  ])).digest('hex');
  async function findTestAppointment(booking) {
    const range = interval(booking.start, booking.end);
    const query = new URLSearchParams({ startDateTime: range.start, endDateTime: range.end,
      '$select': 'id,transactionId,start,end,isCancelled', '$top': '100' });
    let next = `${GRAPH}/me/calendar/calendarView?${query}`, pages = 0;
    const seen = new Set(), matches = [];
    while (next) {
      const u = new URL(next);
      if (u.origin !== 'https://graph.microsoft.com' || u.pathname !== '/v1.0/me/calendar/calendarView' ||
          seen.has(next) || ++pages > 100) fail('CALENDAR_UNAVAILABLE', 'Test appointment could not be fully checked.');
      seen.add(next);
      const data = await request(next);
      if (!Array.isArray(data.value)) fail('CALENDAR_UNAVAILABLE', 'Test appointment could not be checked.');
      matches.push(...data.value.filter(x => x.transactionId === testId(booking) && !x.isCancelled));
      next = data['@odata.nextLink'];
      if (next !== undefined && typeof next !== 'string') fail('CALENDAR_UNAVAILABLE', 'Test appointment could not be fully checked.');
    }
    if (matches.length > 1) fail('CALENDAR_RECONCILIATION_REQUIRED', 'Multiple matching test appointments need review.');
    const found = matches[0];
    if (!found) return null;
    if (new Date(graphTime(found.start)).toISOString() !== range.start ||
        new Date(graphTime(found.end)).toISOString() !== range.end)
      fail('CALENDAR_RECONCILIATION_REQUIRED', 'The test appointment was changed in Outlook.');
    return { eventId: found.id, verified: true };
  }
  async function createTestAppointment(booking) {
    if (binding.provider !== 'microsoft' || !booking.id)
      fail('INVALID_CALENDAR_BOOKING', 'An Outlook test booking is required.');
    const range = interval(booking.start, booking.end);
    if (Date.parse(range.end) - Date.parse(range.start) !== 15 * 60000)
      fail('INVALID_CALENDAR_BOOKING', 'The test appointment must last 15 minutes.');
    const blocks = await busy(range.start, range.end);
    if (blocks.some(x => x.start < range.end && x.end > range.start))
      fail('CALENDAR_SLOT_UNAVAILABLE', 'This time is busy. Choose another test time.');
    const result = await request(eventsUrl, 'POST', {
      transactionId: testId(booking), subject: 'WelcomeFlow TEST — calendar connection',
      body: { contentType: 'text', content: '15-minute WelcomeFlow connector test. No candidate or interview invitation. You may remove this test appointment from Outlook after verification.' },
      start: graphDate(range.start), end: graphDate(range.end),
      showAs: 'busy', isReminderOn: false, attendees: [],
    });
    if (!result.id) fail('CALENDAR_WRITE_UNKNOWN', 'The test result needs reconciliation.');
    return { eventId: result.id };
  }
  return { busy, createEvent, inspectAccount, createTestAppointment, findTestAppointment };
}

module.exports = { createCalendarProvider, SCOPES };
