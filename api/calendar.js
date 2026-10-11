const security = require('../server/welcomeflowApiSecurity');
const { snapshot } = require('../server/workflow/store');
const { need, isId } = require('../src/workflow/engine');
const { createConnectionService } = require('../server/workflow/calendarConnection');
module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  try {
    need(['GET', 'POST'].includes(req.method), 'METHOD', 'Method not allowed.', 405);
    need(process.env.VERCEL_ENV === 'preview' && process.env.WELCOMEFLOW_MAINTENANCE_MODE !== 'true',
      'DISABLED', 'Calendar connection tests are available only in Preview.', 503);
    const runtime = security.readServerRuntimeConfig('workflow');
    need(runtime.ok && ['test', 'acceptance', 'preview'].includes(runtime.environment), 'DISABLED', 'The isolated test runtime is required.', 503);
    need(security.requestPayloadBytes(req) <= 4096, 'TOO_LARGE', 'Request is too large.', 413);
    const limit = await security.consumePreAuthenticationRateLimit(req, { action: 'workflow', limit: 30 });
    need(limit.ok, 'RATE_LIMIT', 'Please try again shortly.', limit.limited ? 429 : 503);
    const auth = await security.authenticatedUser(req);
    need(auth.user, 'AUTH_REQUIRED', 'Sign in to WelcomeFlow to connect your calendar.', auth.unavailable ? 503 : 401);
    const workspaceId = String(req.headers?.['x-welcomeflow-workspace-id'] || '');
    need(isId(workspaceId) && workspaceId.length <= 80 && String(process.env.WELCOMEFLOW_API_WORKSPACE_IDS || '').split(/[;,\s]+/).includes(workspaceId),
      'FORBIDDEN', 'This workspace is not enabled.', 403);
    const client = security.serviceSupabaseClient(runtime);
    const snap = await snapshot(client, workspaceId);
    need(snap.members.some(x => x.userId === auth.user.id && x.active), 'FORBIDDEN', 'An active workspace membership is required.', 403);
    const service = createConnectionService({ client, workspaceId, userId: auth.user.id, projectRef: runtime.projectRef });
    let result;
    if (req.method === 'GET') result = await service.status();
    else {
      const p = req.body || {};
      switch (p.action) {
        case 'authorize': result = await service.authorize(); break;
        case 'verify': result = await service.verify(); break;
        case 'availability': result = await service.availability(p.start, p.end); break;
        case 'book_test': result = await service.book(p.id, p.start); break;
        case 'reconcile': result = await service.reconcile(p.id); break;
        case 'disconnect': result = await service.disconnect(); break;
        default: need(false, 'INVALID_COMMAND', 'Choose a supported calendar action.', 400);
      }
    }
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, ...result }));
  } catch (e) {
    res.statusCode = e.status || 503;
    const safe = e.status || (typeof e.code === 'string' && /^(CALENDAR_|INVALID_CALENDAR_|UNSUPPORTED_CALENDAR)/.test(e.code));
    res.end(JSON.stringify({ ok: false, code: safe ? e.code : 'CALENDAR_UNAVAILABLE',
      error: safe ? e.message : 'Calendar access could not be verified. Your saved test request remains available for checking.' }));
  }
};
