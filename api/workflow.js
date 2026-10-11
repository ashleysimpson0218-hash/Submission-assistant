const {
  authenticatedUser,
  consumePreAuthenticationRateLimit,
  consumeSharedRateLimits,
  requestPayloadBytes,
  readServerRuntimeConfig,
  serviceSupabaseClient,
} = require("../server/welcomeflowApiSecurity");
const { snapshot, execute, view } = require("../server/workflow/store");
const { verifyCapability } = require("../server/workflow/capabilities");
const { need, isId } = require("../src/workflow/engine");
const USER_COMMANDS = new Set([
  "configure_policy",
  "configure_requisition",
  "reassign_requisition_owner",
  "set_requisition_active",
  "handoff",
  "decision",
  "decline_follow_up",
  "proceed_with_slots",
  "offer_slots",
  "complete_interview",
  "feedback",
  "withdraw",
  "recover_delivery",
  "resolve_exception",
  "update_contact",
  "reassign_owner",
  "replace_candidate_link",
]);
function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}
function candidateView(snap, actor) {
  const c = snap.state.cases.find((x) => x.id === actor.caseId),
    r = snap.state.requisitions.find((x) => x.id === c?.requisitionId),
    s = c?.stages[actor.stageIndex];
  need(
    r?.active &&
      s &&
      c.linkVersion === actor.linkVersion &&
      c.status !== "withdrawn",
    "LINK_INACTIVE",
    "This interview link is no longer active.",
    403,
  );
  need(
    actor.purpose !== "booking" ||
      (c.stageIndex === actor.stageIndex && c.status === "selection_pending"),
    "LINK_INACTIVE",
    "This scheduling request is no longer active.",
    403,
  );
  return {
    caseId: c.id,
    expectedVersion: c.version,
    stageName: s.name,
    requisition: r.title,
    purpose: actor.purpose,
    slots: actor.purpose === "booking" ? s.slots : [],
    responded: Boolean(s.experience),
  };
}
module.exports = async function handler(req, res) {
  try {
    need(
      process.env.WELCOMEFLOW_MAINTENANCE_MODE !== "true",
      "MAINTENANCE",
      "WelcomeFlow is temporarily unavailable.",
      503,
    );
    need(
      ["GET", "POST"].includes(req.method),
      "METHOD",
      "Method not allowed.",
      405,
    );
    const runtime = readServerRuntimeConfig("workflow");
    need(runtime.ok, "DISABLED", runtime.error, 503);
    need(
      requestPayloadBytes(req) <= 32768,
      "TOO_LARGE",
      "Request is too large.",
      413,
    );
    const limit = await consumePreAuthenticationRateLimit(req, {
      action: "workflow",
      limit: 60,
    });
    need(
      limit.ok,
      "RATE_LIMIT",
      "Please try again shortly.",
      limit.limited ? 429 : 503,
    );
    const workspaceId = String(
      req.headers?.["x-welcomeflow-workspace-id"] || "",
    );
    need(
      isId(workspaceId) && workspaceId.length <= 80,
      "WORKSPACE",
      "A workspace is required.",
      400,
    );
    const client = serviceSupabaseClient(runtime);
    need(
      client,
      "STORAGE_UNAVAILABLE",
      "Workflow storage is unavailable.",
      503,
    );
    const token = req.headers?.["x-welcomeflow-candidate-token"];
    let identity;
    if (token) {
      identity = verifyCapability(
        token,
        process.env.WELCOMEFLOW_CANDIDATE_LINK_SECRET,
      );
      need(
        identity.workspaceId === workspaceId,
        "FORBIDDEN",
        "Wrong workspace.",
        403,
      );
    } else {
      const auth = await authenticatedUser(req);
      need(
        auth.user,
        "AUTH_REQUIRED",
        "Sign in to view your interview work.",
        auth.unavailable ? 503 : 401,
      );
      identity = { userId: auth.user.id };
    }
    const allowed = String(process.env.WELCOMEFLOW_API_WORKSPACE_IDS || "")
      .split(/[;,\s]+/)
      .includes(workspaceId);
    need(allowed, "FORBIDDEN", "Workspace access is disabled.", 403);
    const shared = await consumeSharedRateLimits({
      action: "workflow",
      subjects: [`user:${identity.userId}`, `workspace:${workspaceId}`],
      limit: 120,
    });
    need(
      shared.ok,
      "RATE_LIMIT",
      "Workflow is temporarily busy.",
      shared.limited ? 429 : 503,
    );
    let snap = await snapshot(client, workspaceId),
      actor =
        identity.role === "candidate"
          ? identity
          : snap.members.find((m) => m.userId === identity.userId && m.active);
    need(
      actor,
      "FORBIDDEN",
      "This account is not authorized for this workspace.",
      403,
    );
    if (req.method === "POST") {
      const cmd = req.body;
      need(
        cmd &&
          typeof cmd === "object" &&
          !Array.isArray(cmd) &&
          isId(cmd.id) &&
          cmd.payload &&
          typeof cmd.payload === "object" &&
          !Array.isArray(cmd.payload),
        "INVALID_COMMAND",
        "A valid workflow action is required.",
        400,
      );
      if (actor.role === "candidate") {
        need(
          (actor.purpose === "booking" && cmd.type === "book") ||
            (actor.purpose === "experience" && cmd.type === "experience"),
          "FORBIDDEN",
          "This link cannot perform that action.",
          403,
        );
        need(
          cmd.payload.caseId === actor.caseId,
          "FORBIDDEN",
          "Wrong candidate context.",
          403,
        );
      } else
        need(
          USER_COMMANDS.has(cmd.type),
          "FORBIDDEN",
          "This action is not available to user accounts.",
          403,
        );
      const result = await execute(client, workspaceId, cmd, actor);
      if (["book", "handoff", "decision", "offer_slots", "decline_follow_up", "proceed_with_slots"].includes(cmd.type)) {
        // The reservation and outbox commit first. A transport failure cannot undo the booking.
        // Replayed booking requests use the same durable outbox; accepted/unknown sends are not replayed.
        const worker = require("./workflow-worker");
        await worker(
          {
            method: "POST",
            headers: {
              authorization: `Bearer ${process.env.WELCOMEFLOW_WORKFLOW_WORKER_SECRET || ""}`,
            },
            body: cmd.type === "book" ? {workspaceId, confirmationCaseId: actor.caseId} : {workspaceId, caseId: cmd.payload.caseId || result.snapshot.state.cases.find(c => c.candidateId === cmd.payload.candidateId && c.requisitionId === cmd.payload.requisitionId)?.id},
          },
          { setHeader() {}, end() {}, statusCode: 0 },
        );
      }
      snap = await snapshot(client, workspaceId);
      actor = result.actor;
      if (actor.role === "candidate")
        return json(res, 200, {
          ok: true,
          duplicate: result.duplicate,
          completed: true,
        });
      return json(res, 200, {
        ok: true,
        duplicate: result.duplicate,
        view: view(snap, actor),
      });
    }
    return json(res, 200, {
      ok: true,
      view:
        actor.role === "candidate"
          ? candidateView(snap, actor)
          : view(snap, actor),
    });
  } catch (e) {
    return json(res, e.status || 503, {
      ok: false,
      code: e.code || "WORKFLOW_UNAVAILABLE",
      error: e.status
        ? e.message
        : "Workflow is temporarily unavailable. Your pending work remains recorded.",
    });
  }
};
module.exports.candidateView = candidateView;
