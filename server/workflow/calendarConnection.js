// Preview-only calendar acceptance workflow. All identity and bindings stay server-owned.
const { createHash, randomUUID } = require('node:crypto');
const { snapshot, hash } = require('./store');
const { need } = require('../../src/workflow/engine');
const { createCalendarProvider } = require('./calendarProviders');
const CONNECTOR = 'microsoft/welcomeflow-preview';
const SCOPES = ['User.Read', 'Calendars.ReadWrite'];
function subjectId(workspaceId, userId, projectRef) {
  return `wf-${createHash('sha256').update(JSON.stringify([projectRef, workspaceId, userId])).digest('hex')}`;
}
function ownConnection(state, userId) {
  return (state.calendarConnections || []).find(x => x.memberId === userId && x.provider === 'microsoft');
}
function ownTests(state, userId) {
  return (state.calendarTests || []).filter(x => x.memberId === userId);
}
function publicStatus(state, userId) {
  const c = ownConnection(state, userId);
  return { connection: c ? { email: c.email, verifiedAt: c.verifiedAt, provider: c.provider } : null,
    tests: ownTests(state, userId).map(({ id, start, end, status, eventId, code }) => ({ id, start, end, status, eventId, code })) };
}
async function commit(client, workspaceId, userId, commandId, fingerprint, transform) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const snap = await snapshot(client, workspaceId);
    const actor = snap.members.find(x => x.userId === userId && x.active);
    need(actor, 'FORBIDDEN', 'Your workspace access changed.', 403);
    const state = JSON.parse(JSON.stringify(snap.state));
    transform(state);
    state.revision = snap.state.revision + 1;
    const { data, error } = await client.rpc('welcomeflow_commit_workflow', {
      p_workspace_id: workspaceId, p_expected_revision: snap.state.revision,
      p_command_id: commandId, p_fingerprint: fingerprint, p_actor_id: userId,
      p_actor_role: actor.role, p_member_version: actor.version,
      p_source_updated_at: snap.sourceUpdatedAt, p_state: state,
      p_events: [{ type: 'calendar.test_updated', actorId: userId, actorRole: actor.role,
        occurredAt: new Date().toISOString(), details: { action: commandId.split(':')[0] } }],
    });
    need(!error, 'STORAGE_UNAVAILABLE', 'Calendar test state could not be saved. Check its status before retrying.', 503);
    if (['committed', 'duplicate'].includes(data?.status)) return data.status;
    need(data?.status === 'revision_conflict' || data?.status === 'source_conflict',
      'FORBIDDEN', 'Calendar test access or request changed.', 403);
  }
  need(false, 'WRITE_CONFLICT', 'Other workspace work changed. Refresh and try again.', 409);
}
function createConnectionService({ client, workspaceId, userId, projectRef, providerFactory = createCalendarProvider, sdk }) {
  const subject = subjectId(workspaceId, userId, projectRef);
  const params = { subject: { type: 'user', id: subject }, scopes: SCOPES };
  const current = async () => (await snapshot(client, workspaceId)).state;
  const mutate = (action, transform) => commit(client, workspaceId, userId,
    `${action}:${randomUUID()}`, hash([action, userId, randomUUID()]), transform);
  const provider = c => providerFactory(c);
  async function binding() {
    const c = ownConnection(await current(), userId);
    need(c && c.userId === subject && c.connectorId === CONNECTOR, 'CALENDAR_CONNECTION_REQUIRED', 'Connect and verify your Outlook calendar first.', 409);
    return c;
  }
  async function checkedProvider(c) {
    const adapter = provider(c), account = await adapter.inspectAccount();
    need(account.accountId === c.accountId && account.providerCalendarId === c.providerCalendarId,
      'CALENDAR_CONNECTION_REQUIRED', 'The authorized Outlook account changed. Verify your calendar again.', 409);
    return adapter;
  }
  async function updateTest(id, changes) {
    await mutate('calendar-result', state => {
      const row = ownTests(state, userId).find(x => x.id === id);
      need(row, 'NOT_FOUND', 'Test appointment was not found.', 404);
      Object.assign(row, changes);
    });
  }
  return {
    async status() { return publicStatus(await current(), userId); },
    async authorize() {
      const connect = sdk || await import('@vercel/connect');
      const result = await connect.startAuthorization(CONNECTOR, params);
      const url = new URL(result.url);
      need(url.origin === 'https://connect.vercel.com' && url.pathname.startsWith('/authorize/'),
        'AUTHORIZATION_UNAVAILABLE', 'Calendar authorization could not be opened.', 503);
      return { authorizationUrl: result.url };
    },
    async verify() {
      // This temporary marker only satisfies adapter construction; the provider supplies the saved identity.
      const base = { provider: 'microsoft', connectorId: CONNECTOR, userId: subject,
        workspaceId, memberId: userId, calendarId: 'primary', email: 'verification-pending' };
      const account = await provider(base).inspectAccount();
      await mutate('calendar-connect', state => {
        const old = ownConnection(state, userId);
        const unresolved = ownTests(state, userId).some(t => ['pending', 'unknown'].includes(t.status));
        need(!old || old.accountId === account.accountId || !unresolved, 'CALENDAR_RECONCILIATION_REQUIRED',
          'Resolve the pending test before changing Outlook accounts.', 409);
        state.calendarConnections = (state.calendarConnections || []).filter(x => x.memberId !== userId || x.provider !== 'microsoft');
        state.calendarConnections.push({ ...base, ...account, verifiedAt: new Date().toISOString() });
      });
      return this.status();
    },
    async availability(start, end) {
      const c = await binding();
      const blocks = await (await checkedProvider(c)).busy(start, end);
      return { busy: blocks, checkedAt: new Date().toISOString(), email: c.email };
    },
    async book(id, start) {
      need(typeof id === 'string' && /^[a-f0-9-]{36}$/i.test(id), 'INVALID_COMMAND', 'A stable test ID is required.', 400);
      need(typeof start === 'string' && /Z$/.test(start) && Number.isFinite(Date.parse(start)), 'INVALID_TIME', 'Choose a valid test time.', 400);
      const canonical = new Date(start).toISOString(), end = new Date(Date.parse(start) + 900000).toISOString();
      const state = await current(), existing = ownTests(state, userId).find(x => x.id === id);
      if (existing) {
        need(existing.start === canonical, 'COMMAND_REUSED', 'This test ID belongs to another time.', 409);
        return this.reconcile(id);
      }
      need(Date.parse(start) > Date.now() + 60000 && Date.parse(start) < Date.now() + 30 * 86400000,
        'INVALID_TIME', 'Choose a future time within 30 days.', 400);
      const c = await binding();
      const booking = { id, start: canonical, end, memberId: userId, accountId: c.accountId, status: 'pending' };
      const outcome = await commit(client, workspaceId, userId, `calendar-test:${id}`, hash([userId, canonical, end]), state => {
        const existing = (state.calendarTests || []).find(x => x.id === id);
        if (existing) {
          need(existing.memberId === userId && existing.start === canonical, 'COMMAND_REUSED', 'This test ID belongs to another request.', 409);
          return;
        }
        need(ownTests(state, userId).length < 20, 'TEST_LIMIT', 'The preview has reached its 20-appointment test limit.', 409);
        need(!(state.calendarTests || []).some(x => x.accountId === c.accountId && x.status !== 'failed' && x.start < end && x.end > canonical),
          'CALENDAR_SLOT_UNAVAILABLE', 'A saved test already reserves this time.', 409);
        need(ownConnection(state, userId)?.accountId === c.accountId, 'CALENDAR_CONNECTION_REQUIRED', 'Your connected account changed.', 409);
        state.calendarTests = [...(state.calendarTests || []), booking];
      });
      if (outcome === 'duplicate') return this.reconcile(id);
      try {
        const result = await (await checkedProvider(c)).createTestAppointment(booking);
        await updateTest(id, { status: 'created', eventId: result.eventId });
      } catch (e) {
        const definite = ['CALENDAR_SLOT_UNAVAILABLE', 'INVALID_CALENDAR_BOOKING', 'CALENDAR_AUTHORIZATION_REQUIRED'].includes(e.code);
        await updateTest(id, { status: definite ? 'failed' : 'unknown', code: definite ? e.code : 'CALENDAR_RECONCILIATION_REQUIRED' });
        if (definite) throw e;
      }
      return this.reconcile(id);
    },
    async reconcile(id) {
      const state = await current(), row = ownTests(state, userId).find(x => x.id === id);
      need(row, 'NOT_FOUND', 'Test appointment was not found.', 404);
      if (row.status === 'failed') return this.status();
      const c = await binding();
      need(row.accountId === c.accountId, 'CALENDAR_RECONCILIATION_REQUIRED', 'Reconnect the Outlook account used for this test.', 409);
      const result = await (await checkedProvider(c)).findTestAppointment(row);
      if (result) await updateTest(id, { status: 'verified', eventId: result.eventId, code: null });
      else if (row.status === 'verified') await updateTest(id, { status: 'unknown', code: 'CALENDAR_RECONCILIATION_REQUIRED' });
      // An absent event after an uncertain write is not permission to issue another create.
      return this.status();
    },
    async disconnect() {
      await mutate('calendar-disconnect', state => {
        need(!ownTests(state, userId).some(t => ['pending', 'unknown', 'created'].includes(t.status)),
          'CALENDAR_RECONCILIATION_REQUIRED', 'Check the pending appointment before disconnecting.', 409);
        state.calendarConnections = (state.calendarConnections || []).filter(x => x.memberId !== userId);
      });
      return this.status();
    },
  };
}
module.exports = { createConnectionService, subjectId, publicStatus, commit };
