const crypto = require("crypto");
const worker = require("./workflow-worker");
const { isId } = require("../src/workflow/engine");

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function authorized(req) {
  const expected = process.env.WELCOMEFLOW_WORKFLOW_WORKER_SECRET;
  const provided = String(req.headers?.authorization || "").replace(/^Bearer /, "");
  return (
    expected?.length >= 32 &&
    provided.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
  );
}

function workspaceIds() {
  return [...new Set(String(process.env.WELCOMEFLOW_API_WORKSPACE_IDS || "")
    .split(/[;,\s]+/)
    .filter(Boolean))];
}

async function handler(req, res) {
  if (req.method !== "POST")
    return send(res, 405, { ok: false, code: "METHOD", error: "Use POST." });
  if (!authorized(req))
    return send(res, 403, { ok: false, code: "FORBIDDEN", error: "Scheduler authorization is required." });
  const workspaces = workspaceIds();
  if (!workspaces.length || workspaces.length > 20 || workspaces.some((id) => id.length > 80 || !isId(id)))
    return send(res, 503, { ok: false, code: "WORKSPACE_CONFIGURATION", error: "Scheduled workspaces are not configured safely." });

  const results = [];
  for (const workspaceId of workspaces) {
    let result;
    try {
      result = await worker.runInternal({ workspaceId });
    } catch {
      result = { ok: false, code: "WORKER_FAILED" };
    }
    results.push({
      workspaceId,
      ok: result?.ok === true,
      processed: Number(result?.processed || 0),
      code: result?.code || null,
    });
  }
  const failed = results.filter((result) => !result.ok);
  return send(res, failed.length ? 503 : 200, {
    ok: failed.length === 0,
    processed: results.reduce((total, result) => total + result.processed, 0),
    results,
  });
}

module.exports = handler;
