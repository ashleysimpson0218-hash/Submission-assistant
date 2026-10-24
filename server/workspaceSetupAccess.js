// Narrow setup access. No candidate payloads, membership edits or provider actions.
const TEST_PROJECT = 'bjverobaoujhfaylyrzi';
const RPC = 'welcomeflow_access_workspace_setup';
const FIELDS = Object.freeze({ companyName: 200, recruiterName: 200, recruiterEmail: 254, signOffLine: 1000, includeSignatureLineInEmails: 'boolean' });
const MESSAGES = Object.freeze({
  DISABLED: 'Protected setup is not enabled in this environment.',
  METHOD: 'Method not allowed.',
  TOO_LARGE: 'This setup request is too large.',
  CONTENT_TYPE: 'Send setup changes as JSON.',
  INVALID_REQUEST: 'Review the setup fields and refresh before saving.',
  AUTH_REQUIRED: 'Sign in again before opening or saving setup.',
  FORBIDDEN: 'This account cannot access the requested workspace setup.',
  RATE_LIMIT: 'Please wait before trying setup again.',
  CONFLICT: 'The workspace changed. Reload and review your edits before saving.',
  UNAVAILABLE: 'Setup could not be confirmed. No successful save is assumed.',
});
const own = (o, key) => Object.prototype.hasOwnProperty.call(o, key);
function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}
function validVersion(value) {
  return typeof value === 'string' && value.length <= 40
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && Number.isFinite(Date.parse(value));
}
function validFields(value, nonempty = false) {
  if (!record(value)) return false;
  const keys = Object.keys(value);
  return (!nonempty || keys.length > 0) && keys.length <= Object.keys(FIELDS).length && keys.every((key) => {
    if (!own(FIELDS, key)) return false;
    if (FIELDS[key] === 'boolean') return typeof value[key] === 'boolean';
    if (typeof value[key] !== 'string' || value[key].length > FIELDS[key] || value[key].includes('\0')) return false;
    return key !== 'recruiterEmail' || !value[key].trim()
      || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value[key]);
  });
}
function parseSave(body) {
  let value = body;
  if (typeof value === 'string') { try { value = JSON.parse(value); } catch { return null; } }
  if (!record(value) || Object.keys(value).length !== 2 || !own(value, 'expectedUpdatedAt') || !own(value, 'changes')
    || !validVersion(value.expectedUpdatedAt) || !validFields(value.changes, true)) return null;
  return { expectedUpdatedAt: value.expectedUpdatedAt, changes: { ...value.changes } };
}
function reply(res, status, code, extra = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Authorization, X-WelcomeFlow-Workspace-Id');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(code ? { ok: false, code, error: MESSAGES[code] } : { ok: true, ...extra }));
}
function validResult(data, workspaceId, operation, save) {
  if (!record(data) || data.status !== (operation === 'read' ? 'loaded' : 'saved')
    || data.workspaceId !== workspaceId || !validVersion(data.updatedAt) || !validFields(data.fields)) return false;
  if (operation === 'save' && (data.updatedAt === save.expectedUpdatedAt
    || !Object.keys(save.changes).every((key) => own(data.fields, key) && data.fields[key] === save.changes[key]))) return false;
  return true;
}
function createWorkspaceSetupHandler(security, env = process.env) {
  return async function handler(req, res) {
    try {
      if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); return reply(res, 405, 'METHOD'); }
      const runtime = security.readServerRuntimeConfig();
      // Initial repair is deliberately restricted to the approved synthetic project.
      if (!runtime.ok || !['test', 'preview'].includes(runtime.environment) || runtime.projectRef !== TEST_PROJECT
        || env.WELCOMEFLOW_ENABLE_WORKSPACE_SETUP_ACTIONS !== 'true' || env.WELCOMEFLOW_MAINTENANCE_MODE === 'true') {
        return reply(res, 503, 'DISABLED');
      }
      if (security.requestPayloadBytes(req) > 8192) return reply(res, 413, 'TOO_LARGE');
      const preauth = await security.consumePreAuthenticationRateLimit(req, { action: 'workspace-setup', limit: 30 });
      if (!preauth?.ok) return reply(res, preauth?.limited ? 429 : 503, preauth?.limited ? 'RATE_LIMIT' : 'UNAVAILABLE');
      const access = await security.authorizedRecruiter(req);
      if (!access?.user) return reply(res, access?.forbidden ? 403 : access?.unavailable ? 503 : 401,
        access?.forbidden ? 'FORBIDDEN' : access?.unavailable ? 'UNAVAILABLE' : 'AUTH_REQUIRED');
      if (!['admin', 'recruiter'].includes(access.role) || !/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(access.workspaceId)
        || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(access.user.id)) {
        return reply(res, 403, 'FORBIDDEN');
      }
      const limit = await security.consumeSharedRateLimits({ action: 'workspace-setup',
        subjects: [`user:${access.user.id}`, `workspace:${access.workspaceId}`], limit: 60 });
      if (!limit?.ok) return reply(res, limit?.limited ? 429 : 503, limit?.limited ? 'RATE_LIMIT' : 'UNAVAILABLE');
      let save = null;
      if (req.method === 'POST') {
        const contentType = String(req.headers?.['content-type'] || req.headers?.['Content-Type'] || '').split(';')[0].trim().toLowerCase();
        if (contentType !== 'application/json') return reply(res, 415, 'CONTENT_TYPE');
        save = parseSave(req.body);
        if (!save) return reply(res, 400, 'INVALID_REQUEST');
      }
      const client = security.serviceSupabaseClient(runtime);
      if (!client) return reply(res, 503, 'UNAVAILABLE');
      const operation = save ? 'save' : 'read';
      const { data, error } = await client.rpc(RPC, {
        p_workspace_id: access.workspaceId, p_actor_id: access.user.id, p_actor_role: access.role,
        p_operation: operation, p_expected_updated_at: save?.expectedUpdatedAt || null, p_changes: save?.changes || {},
      });
      if (error) return reply(res, 503, 'UNAVAILABLE');
      if (data?.status === 'forbidden') return reply(res, 403, 'FORBIDDEN');
      if (data?.status === 'conflict') return reply(res, 409, 'CONFLICT');
      if (data?.status === 'invalid') return reply(res, 400, 'INVALID_REQUEST');
      if (!validResult(data, access.workspaceId, operation, save)) return reply(res, 503, 'UNAVAILABLE');
      // Do not return arbitrary RPC fields, a whole workspace, database details or credentials.
      return reply(res, 200, null, { workspaceId: access.workspaceId, updatedAt: data.updatedAt, fields: data.fields });
    } catch {
      return reply(res, 503, 'UNAVAILABLE');
    }
  };
}
module.exports = { createWorkspaceSetupHandler, parseSave, validFields, validVersion, FIELDS, RPC };
