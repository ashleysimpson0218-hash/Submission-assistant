const text = (value) => String(value ?? "").trim();

export async function recordActionCenterCommunicationAudit({
  client,
  workspaceId,
  phase,
  review = null,
  actionRunId = "",
  resultStatus = "",
  resultCode = "",
  fetchImpl = typeof fetch === "function" ? fetch : null,
} = {}) {
  if (!client || typeof client.auth?.getSession !== "function" || typeof fetchImpl !== "function") {
    return { ok: false, code: "COMMUNICATION_AUDIT_UNAVAILABLE", message: "Communication audit is unavailable in this runtime." };
  }
  const normalizedWorkspaceId = text(workspaceId);
  if (!/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(normalizedWorkspaceId)) {
    return { ok: false, code: "COMMUNICATION_AUDIT_WORKSPACE_INVALID", message: "Communication audit workspace context is invalid." };
  }
  const { data, error } = await client.auth.getSession();
  const accessToken = data?.session?.access_token || "";
  if (error || !accessToken) {
    return { ok: false, code: "COMMUNICATION_AUDIT_AUTH_REQUIRED", message: "Sign in with an authorized recruiter account before completing this action." };
  }
  const body = phase === "begin"
    ? { phase, review: review ? {
      approvalId: text(review.approvalId),
      id: text(review.id),
      actionType: text(review.actionType),
      actionId: text(review.actionId),
      category: text(review.category),
      documentKey: text(review.documentKey),
      context: {
        candidateId: text(review.context?.candidateId),
        requisitionId: text(review.context?.requisitionId),
        facilityId: text(review.context?.facilityId),
      },
      expectedFingerprint: text(review.expectedFingerprint),
    } : null }
    : { phase, actionRunId: text(actionRunId), resultStatus: text(resultStatus), resultCode: text(resultCode) };

  try {
    const response = await fetchImpl("/api/record-communication-action", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "X-WelcomeFlow-Workspace-Id": normalizedWorkspaceId,
      },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result?.ok !== true) {
      return {
        ok: false,
        code: response.status === 409 ? "COMMUNICATION_AUDIT_CONFLICT" : "COMMUNICATION_AUDIT_FAILED",
        message: text(result?.error) || "Communication audit could not be recorded.",
      };
    }
    return result;
  } catch {
    return { ok: false, code: "COMMUNICATION_AUDIT_FAILED", message: "Communication audit could not be recorded." };
  }
}
