// Transport only; not wired into App.js yet. No local-storage or database fallback.
// getAccessToken should obtain the current session token; the server verifies identity.
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const fields = { companyName: 200, recruiterName: 200, recruiterEmail: 254, signOffLine: 1000, includeSignatureLineInEmails: 'boolean' };
const messages = {
  AUTH_REQUIRED: 'Sign in again before opening or saving setup.',
  FORBIDDEN: 'This account cannot access the requested workspace setup.',
  CONFLICT: 'The workspace changed. Reload and review your edits before saving.',
  UNAVAILABLE: 'Setup could not be confirmed. No successful save is assumed.',
  INVALID_REQUEST: 'Review the setup fields and refresh before saving.',
};
const failure = (code) => ({ ok: false, code, error: messages[code] });
const record = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
  && [Object.prototype, null].includes(Object.getPrototypeOf(v));
const version = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(v)
  && Number.isFinite(Date.parse(v));
function validFields(v) {
  return record(v) && Object.keys(v).every((key) => own(fields, key)
    && (fields[key] === 'boolean' ? typeof v[key] === 'boolean'
      : typeof v[key] === 'string' && v[key].length <= fields[key] && !v[key].includes('\0')));
}
function createWorkspaceSetupClient({ workspaceId, getAccessToken, fetchImpl = globalThis.fetch } = {}) {
  if (typeof workspaceId !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(workspaceId)
    || typeof getAccessToken !== 'function' || typeof fetchImpl !== 'function') {
    throw new Error('An explicit workspace and authenticated transport are required.');
  }
  let disposed = false;
  async function send(method, body, editRevision, signal) {
    try {
      if (disposed) return failure('AUTH_REQUIRED');
      const token = await getAccessToken();
      if (disposed) return failure('AUTH_REQUIRED');
      if (typeof token !== 'string' || !token || /\s/.test(token)) return failure('AUTH_REQUIRED');
      const response = await fetchImpl('/api/workspace-setup', {
        method, cache: 'no-store', credentials: 'omit', redirect: 'error', signal,
        headers: { Authorization: `Bearer ${token}`, 'X-WelcomeFlow-Workspace-Id': workspaceId,
          ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (disposed) return failure('AUTH_REQUIRED');
      if (!response.ok) return failure(response.status === 401 ? 'AUTH_REQUIRED' : response.status === 403 ? 'FORBIDDEN'
        : response.status === 409 ? 'CONFLICT' : response.status === 400 ? 'INVALID_REQUEST' : 'UNAVAILABLE');
      const data = await response.json();
      if (disposed) return failure('AUTH_REQUIRED');
      if (!record(data) || data.ok !== true || data.workspaceId !== workspaceId || !version(data.updatedAt) || !validFields(data.fields)) {
        return failure('UNAVAILABLE');
      }
      if (body && (data.updatedAt === body.expectedUpdatedAt
        || !Object.keys(body.changes).every((key) => own(data.fields,key) && data.fields[key] === body.changes[key]))) {
        return failure('UNAVAILABLE');
      }
      return { ok: true, workspaceId, updatedAt: data.updatedAt, fields: { ...data.fields },
        ...(body ? { savedEditRevision: editRevision } : {}) };
    } catch { return failure('UNAVAILABLE'); }
  }
  return {
    // Call on logout, user change or workspace change. It cannot undo a committed request.
    dispose: () => { disposed = true; },
    load: ({ signal } = {}) => send('GET', null, null, signal),
    save: ({ expectedUpdatedAt, changes, editRevision, signal } = {}) => {
      if (!version(expectedUpdatedAt) || !validFields(changes) || !Object.keys(changes).length
        || !Number.isSafeInteger(editRevision) || editRevision < 0) return Promise.resolve(failure('INVALID_REQUEST'));
      // Capture the exact submitted edit; later typing cannot rewrite the acknowledgement.
      return send('POST', { expectedUpdatedAt, changes: { ...changes } }, editRevision, signal);
    },
  };
}
function acknowledgesCurrentSetupEdit(result, { workspaceId, editRevision } = {}) {
  return Number.isSafeInteger(editRevision) && editRevision >= 0
    && result?.ok === true && result.workspaceId === workspaceId && result.savedEditRevision === editRevision;
}
module.exports = { createWorkspaceSetupClient, acknowledgesCurrentSetupEdit };
