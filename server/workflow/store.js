const crypto = require("crypto");
const {
  emptyState,
  applyCommand,
  stateView,
  need,
  canRecruit,
} = require("../../src/workflow/engine");
const hash = (x) =>
  crypto.createHash("sha256").update(JSON.stringify(x)).digest("hex");
const SYSTEM = { userId: "workflow-worker", role: "system", active: true };
async function snapshot(client, workspaceId) {
  const [stateResult, memberResult, sourceResult, eventResult] =
    await Promise.all([
      client
        .from("welcomeflow_workflow_state")
        .select("revision,data")
        .eq("workspace_id", workspaceId)
        .maybeSingle(),
      client
        .from("welcomeflow_workflow_members")
        .select("*")
        .eq("workspace_id", workspaceId),
      client
        .from("welcomeflow_workspace_state")
        .select("data,updated_at")
        .eq("workspace_id", workspaceId)
        .maybeSingle(),
      client
        .from("welcomeflow_workflow_events")
        .select(
          "event_id,type,actor_id,actor_role,requisition_id,case_id,occurred_at,details",
        )
        .eq("workspace_id", workspaceId)
        .order("event_id", { ascending: false })
        .limit(100),
    ]);
  need(
    !stateResult.error &&
      !memberResult.error &&
      !sourceResult.error &&
      !eventResult.error &&
      sourceResult.data,
    "STORAGE_UNAVAILABLE",
    "Workflow storage is unavailable. Existing work has not been changed.",
    503,
  );
  const state = stateResult.data
    ? { ...stateResult.data.data, revision: stateResult.data.revision }
    : emptyState();
  const source = sourceResult.data.data;
  // The existing workspace remains authoritative for requisition closure.
  const sourceReqs = source.settings?.requisitions || [];
  for (const r of state.requisitions) {
    const matches = sourceReqs.filter((x) => x.id === r.id);
    if (
      matches.length !== 1 ||
      String(matches[0].status || "").toLowerCase() !== "active"
    )
      r.active = false;
  }
  return {
    state,
    source,
    events: eventResult.data || [],
    sourceUpdatedAt: sourceResult.data.updated_at,
    members: (memberResult.data || []).map((m) => ({
      userId: m.user_id,
      role: m.role,
      name: m.display_name,
      email: m.email,
      timezone: m.timezone,
      active: m.active,
      version: m.version,
    })),
  };
}
function catalog(snap, actor) {
  const reqs = snap.source.settings?.requisitions || [];
  return {
    requisitions: reqs
      .filter(
        (r) =>
          String(r.status).toLowerCase() === "active" &&
          (actor.role === "admin" ||
            snap.state.requisitions.some(
              (x) => x.id === r.id && canRecruit(actor, x),
            )),
      )
      .map((r) => ({
        id: r.id,
        title: `${r.positionTitle || ""} | ${r.siteName || ""} | ${r.reqNumber || ""}`,
      })),
    candidates: (snap.source.tracker || [])
      .filter(
        (c) =>
          !c.archived &&
          c.reviewedSubmissionPackage &&
          snap.state.requisitions.some(
            (r) => r.id === c.requisitionId && canRecruit(actor, r),
          ),
      )
      .map((c) => ({
        id: c.id,
        requisitionId: c.requisitionId,
        name: c.candidate,
        email: c.candidateEmail,
      })),
  };
}
function enrich(command, snap) {
  const next = JSON.parse(JSON.stringify(command));
  if (next.type === "configure_requisition") {
    const found = (snap.source.settings?.requisitions || []).filter(
      (r) =>
        r.id === next.payload.id && String(r.status).toLowerCase() === "active",
    );
    need(
      found.length === 1,
      "SOURCE_AMBIGUOUS",
      "Confirm one existing active requisition.",
    );
    next.payload.title = `${found[0].positionTitle || ""} | ${found[0].siteName || ""} | ${found[0].reqNumber || ""}`;
  }
  if (next.type === "handoff") {
    const p = next.payload,
      found = (snap.source.tracker || []).filter(
        (c) =>
          c.id === p.candidateId &&
          c.requisitionId === p.requisitionId &&
          !c.archived,
      );
    need(
      found.length === 1 && found[0].reviewedSubmissionPackage?.confirmedAt,
      "PACKET_REQUIRED",
      "Approve the candidate’s existing submission packet before starting the interview workflow.",
    );
    const c = found[0],
      pack = c.reviewedSubmissionPackage;
    need(
      pack.snapshot?.intake?.candidateName === c.candidate &&
        String(pack.snapshot?.intake?.candidateEmail || "").toLowerCase() ===
          String(c.candidateEmail || "").toLowerCase(),
      "STALE_PACKET",
      "The candidate identity changed after packet approval. Review the current packet again.",
    );
    need(
      pack.snapshot?.requisition?.requisitionId === p.requisitionId,
      "STALE_PACKET",
      "The approved packet does not match this requisition.",
    );
    // Only reviewed, minimum packet content enters the new workflow; no private notes or attachments.
    next.payload = {
      ...p,
      caseId: `wf-${hash([p.candidateId, p.requisitionId]).slice(0, 32)}`,
      name: c.candidate,
      email: c.candidateEmail,
      packet:
        pack.rendered?.facilityEmail?.body ||
        pack.documents?.facilitySubmission?.body ||
        `Reviewed candidate: ${c.candidate}\nPosition: ${c.position}\nReview confirmed: ${pack.confirmedAt}`,
    };
  }
  return next;
}
async function execute(client, workspaceId, command, identity, options = {}) {
  const snap = await snapshot(client, workspaceId);
  const actor =
    identity.role === "system" || identity.role === "candidate"
      ? identity
      : snap.members.find((m) => m.userId === identity.userId && m.active);
  need(
    actor,
    "FORBIDDEN",
    "This account is not authorized for this workspace.",
    403,
  );
  const fingerprint = hash({ command, actorId: actor.userId });
  const { data: receipt, error: receiptError } = await client
    .from("welcomeflow_workflow_commands")
    .select("fingerprint")
    .eq("workspace_id", workspaceId)
    .eq("command_id", command.id)
    .maybeSingle();
  need(
    !receiptError,
    "STORAGE_UNAVAILABLE",
    "Command status could not be verified.",
    503,
  );
  if (receipt) {
    need(
      receipt.fingerprint === fingerprint,
      "COMMAND_REUSED",
      "This command ID belongs to a different request.",
    );
    return { duplicate: true, snapshot: snap, actor };
  }
  const now = options.now || new Date().toISOString();
  const result = applyCommand(snap.state, enrich(command, snap), {
    actor,
    members: snap.members,
    now,
  });
  const { data, error } = await client.rpc("welcomeflow_commit_workflow", {
    p_workspace_id: workspaceId,
    p_expected_revision: snap.state.revision,
    p_command_id: command.id,
    p_fingerprint: fingerprint,
    p_actor_id: actor.userId,
    p_actor_role: actor.role,
    p_member_version: actor.version || 0,
    p_source_updated_at: snap.sourceUpdatedAt,
    p_state: result.state,
    p_events: result.events,
  });
  need(
    !error,
    "STORAGE_UNAVAILABLE",
    "The workflow could not be committed. Retry this same action; no completion is assumed.",
    503,
  );
  need(
    data?.status === "committed" || data?.status === "duplicate",
    data?.status === "unauthorized" ? "FORBIDDEN" : "WRITE_CONFLICT",
    "The workflow or permission changed. Refresh and review this action.",
    data?.status === "unauthorized" ? 403 : 409,
  );
  return {
    duplicate: data.status === "duplicate",
    snapshot: await snapshot(client, workspaceId),
    actor,
  };
}
function view(snap, actor) {
  const scoped = stateView(snap.state, actor, snap.members);
  const ids = new Set(scoped.cases.map((c) => c.id));
  return {
    ...scoped,
    audit: (snap.events || [])
      .filter(
        (e) =>
          actor.role === "admin" ||
          (["admin", "recruiter"].includes(actor.role) && ids.has(e.case_id)),
      )
      .map((e) => ({
        ...e,
        details: e.type === "policy.configured" ? undefined : e.details,
      })),
    catalog: ["admin", "recruiter"].includes(actor.role)
      ? catalog(snap, actor)
      : { requisitions: [], candidates: [] },
  };
}
module.exports = { snapshot, execute, view, hash, SYSTEM };
