export const WORKSPACE_TASK_ACTIONS = Object.freeze({
  FOLLOW_UP: "follow-up",
  ESCALATE: "escalate",
  SNOOZE: "snooze",
  REASSIGN: "reassign",
  RESOLVE: "resolve",
  NOT_AT_RISK: "not-at-risk",
  ADD_UPDATE: "add-update",
});

export const WORKSPACE_BULK_TASK_ACTIONS = Object.freeze([
  WORKSPACE_TASK_ACTIONS.SNOOZE,
  WORKSPACE_TASK_ACTIONS.REASSIGN,
  WORKSPACE_TASK_ACTIONS.ADD_UPDATE,
]);

export const WORKSPACE_BULK_ACTION_LIMIT = 50;

const text = (value) => String(value || "").trim();

function recordRequisitionId(record = {}) {
  return text(record.requisitionId || record.selectedRequisitionId || record.formSnapshot?.selectedRequisitionId);
}

function stableHash(value) {
  let hash = 2166136261;
  const input = String(value || "");
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function normalizedBulkOptions(action, options = {}) {
  if (action === WORKSPACE_TASK_ACTIONS.SNOOZE) {
    const snoozeDays = Number.isFinite(Number(options.snoozeDays)) ? Math.max(1, Math.floor(Number(options.snoozeDays))) : 1;
    return { snoozeDays };
  }
  if (action === WORKSPACE_TASK_ACTIONS.REASSIGN) return { ownerType: text(options.ownerType), note: text(options.note) };
  if (action === WORKSPACE_TASK_ACTIONS.ADD_UPDATE) return { note: text(options.note) };
  return {};
}

export function workspaceTaskReviewFingerprint(task = {}) {
  return stableHash(JSON.stringify({
    id: text(task.id),
    sourceType: text(task.sourceType),
    sourceId: text(task.sourceId),
    candidateId: text(task.candidateId),
    requisitionId: text(task.requisitionId),
    candidateName: text(task.candidateName),
    position: text(task.position),
    facilityName: text(task.facilityName),
    title: text(task.title),
    ownerType: text(task.ownerType),
    riskLevel: text(task.riskLevel),
    sourceRevision: text(task.sourceRevision),
  }));
}

function bulkReviewContract({ action, options, items } = {}) {
  return {
    version: 1,
    action: text(action),
    options: normalizedBulkOptions(action, options),
    items: (Array.isArray(items) ? items : []).map((item) => ({
      taskId: text(item.taskId),
      sourceId: text(item.sourceId),
      requisitionId: text(item.requisitionId),
      fingerprint: text(item.fingerprint),
    })),
  };
}

function bulkReviewId(contract) {
  return `workspace-bulk-v1:${stableHash(JSON.stringify(contract))}`;
}

export function workspaceBulkActionLabel(action) {
  return {
    [WORKSPACE_TASK_ACTIONS.SNOOZE]: "Snooze selected tasks for 1 day",
    [WORKSPACE_TASK_ACTIONS.REASSIGN]: "Change selected task owners",
    [WORKSPACE_TASK_ACTIONS.ADD_UPDATE]: "Add an update to selected records",
  }[action] || "Unsupported bulk action";
}

export function prepareWorkspaceBulkTaskReview(tasks = [], action, options = {}) {
  if (!WORKSPACE_BULK_TASK_ACTIONS.includes(action)) return { ok: false, error: "This action is not approved for bulk use." };
  if (!Array.isArray(tasks) || !tasks.length) return { ok: false, error: "Select at least one operational task." };
  if (tasks.length > WORKSPACE_BULK_ACTION_LIMIT) return { ok: false, error: `Select no more than ${WORKSPACE_BULK_ACTION_LIMIT} tasks at once.` };
  if (action === WORKSPACE_TASK_ACTIONS.REASSIGN && !text(options.ownerType)) return { ok: false, error: "Choose the owner who will control every selected next step." };
  if (action === WORKSPACE_TASK_ACTIONS.ADD_UPDATE && !text(options.note)) return { ok: false, error: "Add the update that will be recorded on every selected candidate." };
  const seen = new Set();
  const items = [];
  for (const task of tasks) {
    if (task?.sourceType !== "candidate" || !text(task.id) || !text(task.sourceId)) return { ok: false, error: "Every selected item must be an exact candidate task." };
    if (seen.has(task.id)) return { ok: false, error: "The selected tasks contain a duplicate identity." };
    seen.add(task.id);
    items.push({
      taskId: text(task.id),
      sourceId: text(task.sourceId),
      requisitionId: text(task.requisitionId),
      candidateName: text(task.candidateName) || "Candidate",
      position: text(task.position),
      facilityName: text(task.facilityName),
      title: text(task.title),
      fingerprint: workspaceTaskReviewFingerprint(task),
    });
  }
  const contract = bulkReviewContract({ action, options, items });
  return {
    ok: true,
    review: {
      ...contract,
      id: bulkReviewId(contract),
      label: workspaceBulkActionLabel(action),
      items,
    },
  };
}

export function revalidateWorkspaceBulkTaskReview(review = {}, currentTasks = []) {
  const contract = bulkReviewContract(review);
  if (!review?.id || review.id !== bulkReviewId(contract)) return { ok: false, error: "The bulk-action confirmation no longer matches the reviewed action.", results: [] };
  if (!WORKSPACE_BULK_TASK_ACTIONS.includes(review.action)) return { ok: false, error: "This action is not approved for bulk use.", results: [] };
  const currentById = new Map((Array.isArray(currentTasks) ? currentTasks : []).map((task) => [task.id, task]));
  const results = review.items.map((item) => {
    const current = currentById.get(item.taskId);
    if (!current) return { taskId: item.taskId, ok: false, code: "TASK_NO_LONGER_ELIGIBLE", message: "This task is no longer eligible." };
    if (text(current.sourceId) !== item.sourceId || text(current.requisitionId) !== item.requisitionId) {
      return { taskId: item.taskId, ok: false, code: "TASK_CONTEXT_CHANGED", message: "Candidate or requisition context changed after preview." };
    }
    if (workspaceTaskReviewFingerprint(current) !== item.fingerprint) {
      return { taskId: item.taskId, ok: false, code: "TASK_CHANGED", message: "This task changed after preview and was not updated." };
    }
    return { taskId: item.taskId, ok: true, task: current };
  });
  return { ok: true, results };
}

export function resolveWorkspaceTaskRecord(records = [], task = {}) {
  const sourceId = text(task.sourceId);
  const requisitionId = text(task.requisitionId);
  if (!sourceId) return { ok: false, error: "The candidate task has no stable candidate identity." };
  const matches = [];
  (Array.isArray(records) ? records : []).forEach((record, index) => {
    if (text(record.id) === sourceId && recordRequisitionId(record) === requisitionId) matches.push({ record, index });
  });
  if (matches.length !== 1) return { ok: false, error: matches.length ? "The candidate task matches multiple workspace records." : "The exact candidate and requisition record is no longer available." };
  return { ok: true, ...matches[0] };
}

export function applyWorkspaceBulkTaskReviewToRecords(records = [], currentTasks = [], review = {}, options = {}) {
  const safeRecords = Array.isArray(records) ? records : [];
  const revalidated = revalidateWorkspaceBulkTaskReview(review, currentTasks);
  if (!revalidated.ok) {
    return { ok: false, error: revalidated.error, records: safeRecords, results: [], succeeded: 0, failed: 0, histories: [] };
  }

  const nextRecords = [...safeRecords];
  const histories = [];
  const results = revalidated.results.map((itemResult) => {
    const reviewedItem = review.items.find((item) => item.taskId === itemResult.taskId) || {};
    const base = {
      taskId: itemResult.taskId,
      candidateName: text(reviewedItem.candidateName) || "Candidate",
      requisitionId: text(reviewedItem.requisitionId),
    };
    if (!itemResult.ok) return { ...base, ...itemResult };

    const resolved = resolveWorkspaceTaskRecord(nextRecords, itemResult.task);
    if (!resolved.ok) return { ...base, ok: false, code: "RECORD_UNAVAILABLE", message: resolved.error };

    const applied = applyWorkspaceTaskAction(resolved.record, review.action, {
      ...review.options,
      actor: options.actor,
      now: options.now,
      bulkActionId: review.id,
    });
    if (!applied.ok) return { ...base, ok: false, code: "ACTION_FAILED", message: applied.error };

    nextRecords[resolved.index] = applied.record;
    histories.push(applied.history);
    return { ...base, ok: true, code: "APPLIED", message: applied.history.type };
  });

  const succeeded = results.filter((result) => result.ok).length;
  return {
    ok: true,
    records: nextRecords,
    results,
    succeeded,
    failed: results.length - succeeded,
    histories,
    bulkActionId: review.id,
  };
}

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
    source: text(options.bulkActionId) ? "Recruiter Workspace Bulk Action" : "Recruiter Workspace",
    actor,
    ...(text(options.bulkActionId) ? { bulkActionId: text(options.bulkActionId) } : {}),
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
      meta: {
        candidate: text(record.candidate),
        facility: text(record.site || record.facility),
        requisitionId: recordRequisitionId(record),
        ...(text(options.bulkActionId) ? { bulkActionId: text(options.bulkActionId) } : {}),
      },
    },
  };
}
