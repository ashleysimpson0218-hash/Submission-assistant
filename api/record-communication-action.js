const crypto = require("crypto");
const {
  authorizedRecruiter,
  consumePreAuthenticationRateLimit,
  consumeSharedRateLimits,
  positiveInteger,
  requestPayloadBytes,
  readServerRuntimeConfig,
  serviceSupabaseClient,
} = require("../server/welcomeflowApiSecurity");

const ACTION_TYPES = new Set(["copy-subject", "copy-body", "open-email-draft"]);
const RESULT_STATUSES = new Set(["succeeded", "failed", "cancelled"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REVIEW_FINGERPRINT_PATTERN = /^controlled-communication-v1-[a-f0-9]{8}$/i;
const RESULT_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,79}$/;
const MAX_REQUEST_BYTES = 32768;

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function text(value, limit = 500) {
  return String(value ?? "").trim().slice(0, limit);
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex");
}

function canonicalReviewId(review = {}) {
  return `controlled-communication-v1:${encodeURIComponent(text(review.actionType, 80))}:${encodeURIComponent(text(review.actionId, 1500))}:${encodeURIComponent(text(review.documentKey, 160))}`;
}

function validBeginReview(review = {}) {
  const context = review.context || {};
  return Boolean(
    review && typeof review === "object" && !Array.isArray(review)
    && UUID_PATTERN.test(text(review.approvalId, 80))
    && ACTION_TYPES.has(text(review.actionType, 80))
    && text(review.id, 2000) === canonicalReviewId(review)
    && text(review.actionId, 1500)
    && text(review.category, 120)
    && text(review.documentKey, 160)
    && text(context.candidateId, 240)
    && text(context.requisitionId, 240)
    && text(context.facilityId, 240)
    && REVIEW_FINGERPRINT_PATTERN.test(text(review.expectedFingerprint, 100))
  );
}

async function beginAction(client, authorization, review) {
  const context = review.context || {};
  const idempotencyKey = sha256([
    authorization.workspaceId,
    authorization.user.id,
    review.approvalId,
    review.id,
    review.expectedFingerprint,
  ].join("\n"));
  const contextFingerprint = sha256([
    review.expectedFingerprint,
    review.actionType,
    review.actionId,
    review.documentKey,
    text(context.candidateId, 240),
    text(context.requisitionId, 240),
    text(context.facilityId, 240),
  ].join("\n"));
  const { data, error } = await client.rpc("welcomeflow_begin_communication_action", {
    p_action_run_id: review.approvalId,
    p_workspace_id: authorization.workspaceId,
    p_idempotency_key: idempotencyKey,
    p_actor_user_id: authorization.user.id,
    p_actor_role: authorization.role,
    p_action_type: review.actionType,
    p_action_center_item_id: review.actionId,
    p_category: review.category,
    p_document_key: review.documentKey,
    p_candidate_id: text(context.candidateId, 240),
    p_requisition_id: text(context.requisitionId, 240),
    p_facility_id: text(context.facilityId, 240),
    p_context_fingerprint: contextFingerprint,
  });
  if (error || typeof data !== "string") return { ok: false, unavailable: true };
  if (data === "begun") return { ok: true, status: "begun", actionRunId: review.approvalId };
  if (data.startsWith("duplicate_")) return { ok: true, status: data, actionRunId: review.approvalId, duplicate: true };
  return { ok: false, conflict: data === "conflict" };
}

async function completeAction(client, authorization, payload) {
  const actionRunId = text(payload.actionRunId, 80);
  const resultStatus = text(payload.resultStatus, 40);
  const resultCode = text(payload.resultCode, 80);
  if (!UUID_PATTERN.test(actionRunId) || !RESULT_STATUSES.has(resultStatus) || !RESULT_CODE_PATTERN.test(resultCode)) {
    return { ok: false, invalid: true };
  }
  const { data, error } = await client.rpc("welcomeflow_complete_communication_action", {
    p_action_run_id: actionRunId,
    p_workspace_id: authorization.workspaceId,
    p_actor_user_id: authorization.user.id,
    p_result_status: resultStatus,
    p_result_code: resultCode,
  });
  if (error || typeof data !== "string") return { ok: false, unavailable: true };
  if (data === "completed" || data === `duplicate_${resultStatus}`) {
    return { ok: true, status: data, actionRunId, duplicate: data.startsWith("duplicate_") };
  }
  return { ok: false, conflict: data === "conflict" || data === "not_found" };
}

module.exports = async function handler(req, res) {
  if (process.env.WELCOMEFLOW_MAINTENANCE_MODE === "true") {
    json(res, 503, { error: "WelcomeFlow is temporarily unavailable." });
    return;
  }
  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed." });
    return;
  }
  const runtime = readServerRuntimeConfig("communicationAudit");
  if (!runtime.ok) {
    json(res, 503, { error: runtime.error });
    return;
  }
  if (requestPayloadBytes(req) > MAX_REQUEST_BYTES) {
    json(res, 413, { error: "Communication audit request is too large." });
    return;
  }
  const preAuthRateLimit = await consumePreAuthenticationRateLimit(req, {
    action: "communication-audit",
    limit: positiveInteger(process.env.WELCOMEFLOW_COMMUNICATION_AUDIT_PREAUTH_RATE_LIMIT_PER_MINUTE, 30, 300),
  });
  if (!preAuthRateLimit.ok) {
    json(res, preAuthRateLimit.limited ? 429 : 503, { error: preAuthRateLimit.limited ? "Too many authentication attempts. Try again shortly." : preAuthRateLimit.error });
    return;
  }
  const authorization = await authorizedRecruiter(req);
  if (!authorization.user) {
    json(res, authorization.unavailable ? 503 : authorization.forbidden ? 403 : 401, { error: authorization.error });
    return;
  }
  const rateLimit = await consumeSharedRateLimits({
    action: "communication-audit",
    subjects: [`actor:${authorization.user.id}`, `workspace:${authorization.workspaceId}`],
    limit: positiveInteger(process.env.WELCOMEFLOW_COMMUNICATION_AUDIT_RATE_LIMIT_PER_MINUTE, 60, 600),
  });
  if (!rateLimit.ok) {
    json(res, rateLimit.limited ? 429 : 503, { error: rateLimit.limited ? "Too many communication audit requests. Try again shortly." : rateLimit.error });
    return;
  }
  const payload = req.body && typeof req.body === "object" ? req.body : {};
  const phase = text(payload.phase, 20);
  const client = serviceSupabaseClient(runtime);
  if (!client) {
    json(res, 503, { error: "Communication audit storage is unavailable." });
    return;
  }
  try {
    if (phase === "begin") {
      if (!validBeginReview(payload.review)) {
        json(res, 400, { error: "Communication approval context is invalid." });
        return;
      }
      const result = await beginAction(client, authorization, payload.review);
      if (!result.ok) {
        json(res, result.conflict ? 409 : 503, { error: result.conflict ? "This communication approval conflicts with an existing action." : "Communication audit storage is unavailable." });
        return;
      }
      json(res, 200, result);
      return;
    }
    if (phase === "complete") {
      const result = await completeAction(client, authorization, payload);
      if (!result.ok) {
        json(res, result.invalid ? 400 : result.conflict ? 409 : 503, { error: result.invalid ? "Communication result is invalid." : result.conflict ? "This communication result conflicts with the approved action." : "Communication audit storage is unavailable." });
        return;
      }
      json(res, 200, result);
      return;
    }
    json(res, 400, { error: "Communication audit phase is invalid." });
  } catch {
    json(res, 503, { error: "Communication audit storage is unavailable." });
  }
};
