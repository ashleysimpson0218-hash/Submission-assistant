export const WORKSPACE_TASK_ACTIONS = Object.freeze({
  FOLLOW_UP: "follow-up",
  ESCALATE: "escalate",
  SNOOZE: "snooze",
  REASSIGN: "reassign",
  RESOLVE: "resolve",
  NOT_AT_RISK: "not-at-risk",
  ADD_UPDATE: "add-update",
});

const text = (value) => String(value || "").trim();

function addDays(iso, days) {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function normalizedNow(value) {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) throw new Error("A valid action timestamp is required.");
  return date.toISOString();
}

function escalationLabel(level) {
  if (level >= 3) return "Leadership Escalation";
  if (level === 2) return "Second Escalation";
  return "First Escalation";
}

function historyTypeFor(action) {
  return {
    [WORKSPACE_TASK_ACTIONS.FOLLOW_UP]: "Workspace Follow-Up Logged",
    [WORKSPACE_TASK_ACTIONS.ESCALATE]: "Workspace Escalation Logged",
    [WORKSPACE_TASK_ACTIONS.SNOOZE]: "Workspace Task Snoozed",
    [WORKSPACE_TASK_ACTIONS.REASSIGN]: "Workspace Owner Changed",
    [WORKSPACE_TASK_ACTIONS.RESOLVE]: "Workspace Task Resolved",
    [WORKSPACE_TASK_ACTIONS.NOT_AT_RISK]: "Candidate Risk Override",
    [WORKSPACE_TASK_ACTIONS.ADD_UPDATE]: "Workspace Update Added",
  }[action] || "Workspace Task Updated";
}

export function applyWorkspaceTaskAction(record = {}, action, options = {}) {
  if (!record?.id) return { ok: false, error: "A candidate record is required." };
  if (!Object.values(WORKSPACE_TASK_ACTIONS).includes(action)) return { ok: false, error: "This workspace action is not supported." };
  const now = normalizedNow(options.now);
  const actor = text(options.actor) || "Recruiter";
  const note = text(options.note);
  const patch = { updatedAt: now, lastActionAt: now };
  let detail = note;

  if (action === WORKSPACE_TASK_ACTIONS.FOLLOW_UP) {
    const followUpDays = Number.isFinite(Number(options.followUpDays)) ? Math.max(1, Number(options.followUpDays)) : 2;
    patch.lastFollowUpAt = now;
    patch.followUpCount = Number(record.followUpCount || 0) + 1;
    patch.nextActionDueDate = addDays(now, followUpDays);
    patch.expectedResponseDate = patch.nextActionDueDate;
    patch.waitingSince = now;
    patch.taskStatus = "Waiting";
    patch.nextAction = text(options.nextAction) || `Await response from ${text(record.currentOwner || record.ownerType) || "current owner"}`;
    detail = note || `Follow-up ${patch.followUpCount} logged; response expected within ${followUpDays} days.`;
  }

  if (action === WORKSPACE_TASK_ACTIONS.ESCALATE) {
    patch.escalationLevel = Math.min(3, Number(record.escalationLevel || 0) + 1);
    patch.escalationDate = now;
    patch.lastFollowUpAt = now;
    patch.followUpCount = Number(record.followUpCount || 0) + 1;
    patch.nextActionDueDate = addDays(now, 1);
    patch.expectedResponseDate = patch.nextActionDueDate;
    patch.taskStatus = "Escalated";
    patch.nextAction = text(options.nextAction) || `Monitor ${escalationLabel(patch.escalationLevel).toLowerCase()}`;
    detail = note || `${escalationLabel(patch.escalationLevel)} recorded.`;
  }

  if (action === WORKSPACE_TASK_ACTIONS.SNOOZE) {
    const snoozeDays = Number.isFinite(Number(options.snoozeDays)) ? Math.max(1, Number(options.snoozeDays)) : 1;
    patch.snoozedUntil = options.snoozedUntil || addDays(now, snoozeDays);
    patch.taskStatus = "Snoozed";
    detail = note || `Task snoozed until ${patch.snoozedUntil.slice(0, 10)}.`;
  }

  if (action === WORKSPACE_TASK_ACTIONS.REASSIGN) {
    const ownerType = text(options.ownerType);
    if (!ownerType) return { ok: false, error: "Choose the owner who controls the next step." };
    patch.ownerType = ownerType;
    patch.currentOwner = text(options.currentOwner) || ownerType;
    patch.ownerAssignedAt = now;
    patch.waitingSince = now;
    patch.taskStatus = ownerType === "Recruiter" ? "Open" : "Waiting";
    detail = note || `Next-step ownership changed to ${patch.currentOwner}.`;
  }

  if (action === WORKSPACE_TASK_ACTIONS.RESOLVE) {
    patch.taskStatus = "Completed";
    patch.completedAt = now;
    patch.completedBy = actor;
    patch.focusCompletedAt = now;
    patch.focusCompletedKind = text(options.completionLabel) || "Workspace task resolved";
    patch.nextAction = text(options.nextAction) || record.nextAction;
    patch.snoozedUntil = "";
    detail = note || "The current workspace task was marked resolved.";
  }

  if (action === WORKSPACE_TASK_ACTIONS.NOT_AT_RISK) {
    patch.riskOverride = "Not at risk";
    patch.riskOverrideNote = note;
    patch.riskOverrideAt = now;
    patch.riskOverrideBy = actor;
    detail = note || "Candidate marked not at risk by recruiter review.";
  }

  if (action === WORKSPACE_TASK_ACTIONS.ADD_UPDATE) {
    if (!note) return { ok: false, error: "Add a short update before saving." };
    patch.lastActionLabel = "Workspace update";
    detail = note;
  }

  const auditEntry = {
    id: `workspace-${action}-${now}`,
    timestamp: now,
    label: historyTypeFor(action),
    detail,
    source: "Recruiter Workspace",
    actor,
  };
  patch.audit = [...(Array.isArray(record.audit) ? record.audit : []), auditEntry];
  return {
    ok: true,
    record: { ...record, ...patch },
    patch,
    history: {
      type: historyTypeFor(action),
      subject: text(record.candidate) || "Candidate workflow",
      body: detail,
      trackerId: record.id,
      meta: { candidate: text(record.candidate), facility: text(record.site || record.facility) },
    },
  };
}
