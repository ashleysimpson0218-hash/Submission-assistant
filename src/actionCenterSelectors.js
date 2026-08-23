import { resolveExactRequisition, resolveFacilitySubmissionRecipients } from "./communicationGeneration";
import { validateCandidateReadyFacilitySubmissionPackage } from "./candidateReadyPackageValidation";
import { buildRecruiterWorkspaceModel } from "./recruiterWorkspaceSelectors";
import { buildFacilityIndex, resolveCanonicalFacility, resolveRequisition } from "./weeklyCleanupReporting";

export const ACTION_CENTER_CATEGORIES = Object.freeze({
  all: "All",
  followUp: "Follow-up Due",
  managerFeedback: "Manager Feedback",
  candidateReady: "Candidate Ready",
  dataBlocker: "Data Blockers",
});

export const ACTION_CENTER_FILTERS = Object.freeze(Object.values(ACTION_CENTER_CATEGORIES));

const TERMINAL_CANDIDATE_STATUSES = new Set([
  "archived",
  "candidate withdrew",
  "closed",
  "do not contact",
  "do-not-contact",
  "hired",
  "ineligible",
  "no response",
  "not interested",
  "not selected",
  "offer accepted",
  "onboarding",
  "placed",
  "rejected",
  "unresponsive",
  "withdrew",
  "withdrawn",
]);

const CANONICAL_FINAL_OUTCOMES = new Set([
  "archived",
  "candidate withdrew",
  "closed",
  "do not rehire / do not hire",
  "duplicate",
  "future consideration",
  "hired",
  "ineligible",
  "no response",
  "no show",
  "not interested",
  "not moving forward",
  "not selected",
  "not selected by leadership",
  "offer accepted",
  "offer declined",
  "offer rescinded",
  "placed",
  "position closed",
  "position no longer available",
  "rejected",
  "unresponsive",
  "withdrew",
  "withdrawn",
]);

const ACTIONABLE_READINESS_CODES = new Set([
  "calendar-outcome-missing",
  "facility-ambiguous",
  "facility-disagreement",
  "facility-unmapped",
  "missing-activity-date",
  "missing-candidate-notes",
  "missing-next-action",
  "missing-position",
  "missing-requisition-id",
  "missing-requisition-number",
  "missing-risk-explanation",
  "missing-start-date",
  "unresolved-ownership",
]);

const text = (value) => String(value ?? "").trim();
const lower = (value) => text(value).toLowerCase();

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  const source = text(value);
  const dateOnly = source.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(source);
  return Number.isNaN(date.getTime()) ? null : date;
}

function hoursBetween(from, to) {
  const start = parseDate(from);
  const end = parseDate(to);
  if (!start || !end) return null;
  return Math.max(0, (end.getTime() - start.getTime()) / 3600000);
}

function hasCanonicalFinalOutcome(candidate = {}) {
  return [candidate.interviewOutcome, candidate.finalCandidateOutcome, candidate.hiringDecisionOutcome, candidate.archiveOutcome]
    .some((value) => CANONICAL_FINAL_OUTCOMES.has(lower(value)));
}

function candidateIsTerminal(candidate = {}) {
  return Boolean(candidate.archived)
    || TERMINAL_CANDIDATE_STATUSES.has(lower(candidate.status))
    || hasCanonicalFinalOutcome(candidate);
}

function activeCandidate(candidate = {}) {
  return !candidateIsTerminal(candidate);
}

function activeRequisition(requisition = {}) {
  return !requisition.archived && lower(requisition.status || "Active") === "active";
}

function candidateName(candidate = {}) {
  return text(candidate.candidate || candidate.candidateName || candidate.formSnapshot?.fullName) || "Unnamed candidate";
}

function candidatePosition(candidate = {}, requisition = {}) {
  return text(candidate.position || candidate.formSnapshot?.position || requisition.positionTitle) || "Position not assigned";
}

function candidateLastActivity(candidate = {}) {
  const values = [
    candidate.lastActionAt,
    candidate.updatedAt,
    candidate.lastProfileUpdateAt,
    candidate.candidateFirstResponseAt,
    candidate.submittedToFacilityAt,
    candidate.candidateSubmittedToFacilityAt,
    candidate.submissionDate,
  ].map(parseDate).filter(Boolean);
  return values.length ? new Date(Math.max(...values.map((value) => value.getTime()))) : null;
}

function activeExactRequisitionForCandidate(candidate, requisitions) {
  const resolution = resolveRequisition(candidate, requisitions);
  if (resolution.status !== "resolved" || !resolution.requisition) {
    return { requisition: null, status: resolution.status === "ambiguous" ? "ambiguous" : "unmapped" };
  }
  if (!activeRequisition(resolution.requisition)) {
    return { requisition: null, status: "inactive" };
  }
  const stableId = text(resolution.requisition.id || resolution.requisition.requisitionId);
  if (!stableId) return { requisition: null, status: "missing-id" };
  const exact = resolveExactRequisition(requisitions, stableId);
  if (!exact.value) return { requisition: null, status: exact.blockers?.[0]?.code === "REQUISITION_AMBIGUOUS" ? "ambiguous" : "unmapped" };
  return { requisition: resolution.requisition, status: "resolved" };
}

function canonicalFacilityForSource({ candidate = {}, requisition = {}, sites = [], facilityIndex = null } = {}) {
  candidate = candidate || {};
  requisition = requisition || {};
  const index = facilityIndex || buildFacilityIndex(sites);
  const requisitionResolution = resolveCanonicalFacility({ requisition, sites, facilityIndex: index });
  if (requisitionResolution.status !== "resolved") return requisitionResolution;
  const candidateHasFacilityReference = Boolean(text(candidate.facilityId
    || candidate.siteId
    || candidate.canonicalFacilityId
    || candidate.formSnapshot?.facilityId
    || candidate.formSnapshot?.siteId
    || candidate.site
    || candidate.formSnapshot?.siteName
    || candidate.facility));
  if (!candidateHasFacilityReference) return requisitionResolution;
  const candidateResolution = resolveCanonicalFacility({ candidate, sites, facilityIndex: index });
  if (candidateResolution.status !== "resolved") return candidateResolution;
  if (candidateResolution.facility.id !== requisitionResolution.facility.id) {
    return {
      facility: null,
      status: "disagreement",
      matchedBy: "candidate-requisition-disagreement",
      originalLabel: candidateResolution.originalLabel,
    };
  }
  return requisitionResolution;
}

function contextFor(candidate = {}, requisition = {}, facility = {}) {
  candidate = candidate || {};
  requisition = requisition || {};
  facility = facility || {};
  return {
    candidate: candidateName(candidate),
    candidateId: text(candidate.id),
    requisition: text(requisition.positionTitle || candidatePosition(candidate, requisition)),
    requisitionId: text(requisition.id || requisition.requisitionId),
    requisitionNumber: text(requisition.reqNumber || requisition.uniqueIdNumber || candidate.reqNumber || candidate.formSnapshot?.reqNumber),
    facility: text(facility.siteName || facility.facilityName) || "Facility unresolved",
    facilityId: text(facility.id || facility.facilityId),
    region: text(facility.regionName || facility.region),
    currentOwner: text(candidate.currentOwner || candidate.ownerType || candidate.recruiterOwner || candidate.formSnapshot?.recruiterOwner),
  };
}

export function buildActionCenterItemId({
  category,
  sourceType,
  sourceId,
  candidateId = "",
  requisitionId = "",
  facilityId = "",
  calendarEventId = "",
  issueCode = "",
} = {}) {
  const target = text(sourceId || candidateId || requisitionId || facilityId || calendarEventId || "unresolved");
  const segment = (value) => encodeURIComponent(text(value) || "unresolved");
  const identity = sourceType === "candidate"
    ? `action-center-v1:${segment(category)}:candidate:${segment(candidateId || target)}:requisition:${segment(requisitionId)}:facility:${segment(facilityId)}`
    : `action-center-v1:${segment(category)}:${sourceType}:${segment(target)}`;
  return `${identity}${issueCode ? `:${segment(issueCode)}` : ""}`;
}

function stableActionItem({
  category,
  sourceType,
  sourceId,
  candidateId = "",
  requisitionId = "",
  facilityId = "",
  calendarEventId = "",
  title,
  explanation,
  recommendedAction,
  destination,
  priorityScore,
  riskLevel,
  dueAt = "",
  context = {},
  missingData = [],
  issueCode = "",
  transitionAt = "",
}) {
  const target = text(sourceId || candidateId || requisitionId || facilityId || calendarEventId || "unresolved");
  return {
    id: buildActionCenterItemId({ category, sourceType, sourceId, candidateId, requisitionId, facilityId, calendarEventId, issueCode }),
    category,
    sourceType,
    sourceId: target,
    candidateId: text(candidateId),
    requisitionId: text(requisitionId),
    facilityId: text(facilityId),
    calendarEventId: text(calendarEventId),
    title,
    explanation,
    recommendedAction,
    destination,
    priorityScore: Number(priorityScore || 0),
    riskLevel,
    dueAt: text(dueAt),
    contextStatus: missingData.length ? "correction-required" : "resolved",
    context,
    missingData: [...missingData],
    issueCode,
    transitionAt: text(transitionAt),
    sideEffectClass: "read-only",
    approvalRequired: "Recruiter approval is required before any record or communication changes.",
  };
}

const NON_FINAL_OUTCOMES = new Set([
  "",
  "active",
  "awaiting decision",
  "awaiting feedback",
  "decision pending",
  "feedback pending",
  "interview completed",
  "manager reviewing",
  "needs feedback",
  "no decision",
  "pending",
  "still active",
  "undecided",
]);

const MANAGER_DECISION_STATUSES = new Set([
  "offer",
  "offered",
  "verbal offer",
]);

export function hasSubstantiveManagerFeedback(value) {
  const normalized = lower(value);
  return Boolean(normalized && !NON_FINAL_OUTCOMES.has(normalized));
}

function managerFeedbackReceived(candidate = {}) {
  return Boolean(text(candidate.hiringDecisionReceivedAt
    || candidate.managerFeedbackReceivedAt
    || candidate.facilityFeedbackReceivedAt))
    || hasSubstantiveManagerFeedback(candidate.interviewFeedback)
    || hasCanonicalFinalOutcome(candidate)
    || candidateIsTerminal(candidate)
    || MANAGER_DECISION_STATUSES.has(lower(candidate.status));
}

function configuredFeedbackThreshold(workflowRules = {}) {
  const preferred = workflowRules.interviewFeedbackHours;
  const fallback = workflowRules.workspaceInterviewDecisionDelayHours;
  const value = preferred !== undefined && preferred !== null && preferred !== "" ? Number(preferred) : Number(fallback);
  return Number.isFinite(value) && value >= 0 ? value : 24;
}

function completedInterviewAt(candidate = {}, now = new Date()) {
  const completionStatus = [candidate.status, candidate.interviewCompletionStatus, candidate.bookingStatus, candidate.bookingRecord?.bookingStatus]
    .some((value) => ["completed", "interview completed"].includes(lower(value)));
  const source = candidate.actualInterviewAt || candidate.interviewCompletedAt || (completionStatus ? candidate.interviewDate : "");
  const completedAt = parseDate(source);
  return completedAt && completedAt.getTime() <= now.getTime() ? completedAt : null;
}

function managerFeedbackState(candidate, task, now, workflowRules) {
  if (managerFeedbackReceived(candidate)) return null;
  const explicit = /request feedback|interview feedback/.test(lower(candidate.nextAction));
  const taskRequestsFeedback = task?.ownerType === "Hiring Manager" && /feedback/.test(lower(task?.recommendedAction || task?.title));
  const completedAt = completedInterviewAt(candidate, now);
  if (!explicit && !completedAt && !taskRequestsFeedback) return null;
  const elapsed = completedAt ? hoursBetween(completedAt, now) : null;
  const threshold = configuredFeedbackThreshold(workflowRules);
  const overdue = elapsed != null && elapsed >= threshold;
  const transitionAt = completedAt && !overdue
    ? new Date(completedAt.getTime() + threshold * 3600000).toISOString()
    : "";
  return {
    elapsed,
    interviewAt: completedAt ? completedAt.toISOString() : "",
    overdue,
    threshold,
    transitionAt,
    completionConfirmed: Boolean(completedAt),
  };
}

function candidateReadyPending(candidate = {}, requisition = {}, facility = {}) {
  return validateCandidateReadyFacilitySubmissionPackage(candidate.reviewedSubmissionPackage, {
    candidate,
    requisition,
    facility,
  }).valid;
}

function followUpDue(candidate, task, now, workflowRules, feedbackState = null, readyPackagePending = false) {
  const ownerType = text(task?.ownerType || candidate.ownerType || candidate.currentOwner);
  if (ownerType !== "Recruiter" || feedbackState || readyPackagePending) return false;
  const due = parseDate(task?.dueAt || candidate.nextActionDueDate);
  const lastActivity = candidateLastActivity(candidate);
  const inactiveHours = hoursBetween(lastActivity, now);
  const threshold = Math.max(1, Number(workflowRules.candidateFollowUpDays || 2)) * 24;
  const explicit = /follow.?up|check.?in|reach out|contact candidate|candidate update/.test(lower(candidate.nextAction));
  return Boolean((due && due <= now) || (explicit && (inactiveHours == null || inactiveHours >= threshold)));
}

function futureFollowUpEligibilityAt(candidate, task, now, workflowRules, feedbackState = null, readyPackagePending = false) {
  const ownerType = text(task?.ownerType || candidate.ownerType || candidate.currentOwner);
  if (ownerType !== "Recruiter" || feedbackState || readyPackagePending) return null;
  const candidates = [];
  const due = parseDate(task?.dueAt || candidate.nextActionDueDate);
  if (due && due > now) candidates.push(due);
  const explicit = /follow.?up|check.?in|reach out|contact candidate|candidate update/.test(lower(candidate.nextAction));
  const lastActivity = candidateLastActivity(candidate);
  if (explicit && lastActivity) {
    const thresholdHours = Math.max(1, Number(workflowRules.candidateFollowUpDays || 2)) * 24;
    const inactivityBoundary = new Date(lastActivity.getTime() + thresholdHours * 3600000);
    if (inactivityBoundary > now) candidates.push(inactivityBoundary);
  }
  return candidates.sort((a, b) => a - b)[0] || null;
}

function destinationFor(sourceType, sourceId, requisitionId = "") {
  if (!text(sourceId)) return { type: "unavailable", id: "", label: "Target unavailable", disabled: true, reason: "The affected record has no stable identifier." };
  if (sourceType === "candidate" && !text(requisitionId)) return { type: "unavailable", id: "", requisitionId: "", label: "Target unavailable", disabled: true, reason: "The candidate is not connected to one exact requisition." };
  if (sourceType === "candidate") return { type: "candidate", id: sourceId, requisitionId: text(requisitionId), label: "Open Candidate" };
  if (sourceType === "requisition") return { type: "requisition", id: sourceId, label: "Open Requisition" };
  if (sourceType === "facility") return { type: "facility", id: sourceId, label: "Open Facility" };
  if (sourceType === "calendar") return { type: "calendar", id: sourceId, label: "View Event" };
  return { type: "reporting", id: sourceId, label: "Open Weekly Reporting" };
}

function candidateRowsForIssue(issue, sources) {
  const sourceId = text(issue.sourceId);
  const rows = sources.candidateRowsById.get(sourceId) || [];
  if (rows.length <= 1) return rows;
  return rows.filter((candidate) => {
    const isolated = buildRecruiterWorkspaceModel({
      tracker: [candidate],
      requisitions: sources.requisitions,
      sites: sources.sites,
      history: [],
      calendarEvents: sources.calendarEvents,
      rules: sources.workflowRules,
      now: sources.now,
    });
    return isolated.reportReadiness.issues.some((entry) => entry.sourceType === "candidate" && entry.code === issue.code && text(entry.sourceId) === sourceId);
  });
}

function itemForReadinessIssue(issue, sources, exactCandidate = null) {
  if (!ACTIONABLE_READINESS_CODES.has(issue.code)) return null;
  const sourceId = text(issue.sourceId);
  if (!sourceId) return null;
  const candidateMatches = issue.sourceType === "candidate" && !exactCandidate ? (sources.candidateRowsById.get(sourceId) || []) : [];
  const candidate = exactCandidate || (candidateMatches.length === 1 ? candidateMatches[0] : null);
  const candidateRequisitionResolution = candidate ? activeExactRequisitionForCandidate(candidate, sources.requisitions) : { requisition: null, status: "not-applicable" };
  const exactRequisitionResolution = issue.sourceType === "requisition" && issue.code !== "missing-requisition-id"
    ? resolveExactRequisition(sources.requisitions, sourceId)
    : { value: null };
  const requisition = issue.sourceType === "requisition"
    ? exactRequisitionResolution.value
    : candidateRequisitionResolution.requisition;
  const calendarEvent = issue.sourceType === "calendar" ? sources.calendarById.get(sourceId) : null;
  if (issue.sourceType === "candidate" && (!candidate || !activeCandidate(candidate))) return null;
  if (issue.sourceType === "requisition" && requisition && !activeRequisition(requisition)) return null;
  if (issue.sourceType === "requisition" && !requisition && issue.code !== "missing-requisition-id") return null;
  if (issue.sourceType === "calendar" && !calendarEvent) return null;
  if (issue.sourceType === "candidate" && issue.code !== "missing-requisition-id" && candidateRequisitionResolution.status !== "resolved") return null;
  const facilityResolution = requisition
    ? canonicalFacilityForSource({ candidate, requisition, sites: sources.sites, facilityIndex: sources.facilityIndex })
    : { facility: null, status: "unmapped" };
  const facility = facilityResolution.facility;
  const context = calendarEvent ? {
    candidate: text(calendarEvent.candidateName),
    candidateId: text(calendarEvent.candidateId),
    requisition: text(calendarEvent.position),
    requisitionId: text(calendarEvent.requisitionId),
    facility: text(calendarEvent.facilityName) || "Facility unresolved",
    facilityId: text(calendarEvent.facilityId),
    region: "",
    currentOwner: text(calendarEvent.recruiterName),
  } : issue.sourceType === "requisition" && !requisition ? {
    candidate: "",
    candidateId: "",
    requisition: sourceId,
    requisitionId: "",
    requisitionNumber: "",
    facility: "Facility unresolved",
    facilityId: "",
    region: "",
    currentOwner: "",
  } : contextFor(candidate || {}, requisition || {}, facility || {});
  const sourceType = issue.sourceType;
  const destination = sourceType === "requisition" && !context.requisitionId
    ? { type: "unavailable", id: "", label: "Target unavailable", disabled: true, reason: "The blocker has no exact canonical requisition identity." }
    : destinationFor(sourceType, sourceType === "requisition" ? context.requisitionId : sourceId, context.requisitionId);
  return stableActionItem({
    category: ACTION_CENTER_CATEGORIES.dataBlocker,
    sourceType,
    sourceId,
    candidateId: context.candidateId,
    requisitionId: context.requisitionId,
    facilityId: context.facilityId,
    calendarEventId: sourceType === "calendar" ? sourceId : "",
    title: issue.label,
    explanation: `${issue.label}. This prevents the affected workflow from being treated as complete.`,
    recommendedAction: `Review ${issue.fixLocation || "the affected source record"}`,
    destination,
    priorityScore: ["facility-ambiguous", "facility-disagreement", "facility-unmapped", "missing-requisition-id"].includes(issue.code) ? 88 : 58,
    riskLevel: ["facility-ambiguous", "facility-disagreement", "facility-unmapped", "missing-requisition-id"].includes(issue.code) ? "High" : "Medium",
    context,
    missingData: [issue.code],
    issueCode: issue.code,
  });
}

function itemsForReadinessIssue(issue, sources) {
  if (issue.sourceType !== "candidate") {
    const item = itemForReadinessIssue(issue, sources);
    return item ? [item] : [];
  }
  return candidateRowsForIssue(issue, sources)
    .map((candidate) => itemForReadinessIssue(issue, sources, candidate))
    .filter(Boolean);
}

function contactBlockers(sources) {
  const relevantFacilityIds = new Set();
  sources.requisitions.filter(activeRequisition).forEach((requisition) => {
    const resolution = canonicalFacilityForSource({ requisition, sites: sources.sites, facilityIndex: sources.facilityIndex });
    if (resolution.status === "resolved") relevantFacilityIds.add(text(resolution.facility.id));
  });
  return sources.sites.flatMap((facility) => {
    const facilityId = text(facility.id || facility.facilityId);
    if (!facilityId || !relevantFacilityIds.has(facilityId) || resolveFacilitySubmissionRecipients(facility).blockers.length === 0) return [];
    const context = {
      candidate: "",
      candidateId: "",
      requisition: "",
      requisitionId: "",
      requisitionNumber: "",
      facility: text(facility.siteName || facility.facilityName),
      facilityId,
      region: text(facility.regionName || facility.region),
      currentOwner: "Recruiter",
    };
    return [stableActionItem({
      category: ACTION_CENTER_CATEGORIES.dataBlocker,
      sourceType: "facility",
      sourceId: facilityId,
      facilityId,
      title: "Facility contact is missing",
      explanation: `${context.facility || "The facility"} has no valid facility-report recipient. Communication preparation must remain blocked.`,
      recommendedAction: "Review facility contacts",
      destination: destinationFor("facility", facilityId),
      priorityScore: 86,
      riskLevel: "High",
      context,
      missingData: ["facility-recipient"],
      issueCode: "facility-recipient-missing",
    })];
  });
}

export function buildRecruiterActionCenter({ tracker = [], requisitions = [], sites = [], history = [], calendarEvents = [], workflowRules = {}, now = new Date() } = {}) {
  const current = now instanceof Date ? new Date(now.getTime()) : new Date(now);
  if (Number.isNaN(current.getTime())) throw new Error("A valid Action Center calculation time is required.");
  const safeTracker = Array.isArray(tracker) ? tracker : [];
  const safeRequisitions = Array.isArray(requisitions) ? requisitions : [];
  const safeSites = Array.isArray(sites) ? sites : [];
  const safeEvents = Array.isArray(calendarEvents) ? calendarEvents : [];
  const workspace = buildRecruiterWorkspaceModel({ tracker: safeTracker, requisitions: safeRequisitions, sites: safeSites, history, calendarEvents: safeEvents, rules: workflowRules, now: current });
  const taskKey = (candidateId, requisitionId) => `${text(candidateId)}::${text(requisitionId)}`;
  const taskByCandidateRequisition = new Map(workspace.tasks.filter((task) => task.sourceType === "candidate").map((task) => [taskKey(task.sourceId, task.requisitionId), task]));
  const candidateRowsById = safeTracker.reduce((result, candidate) => {
    const id = text(candidate.id);
    if (id) result.set(id, [...(result.get(id) || []), candidate]);
    return result;
  }, new Map());
  const calendarById = new Map(safeEvents.map((event) => [text(event.id), event]).filter(([id]) => id));
  const facilityIndex = buildFacilityIndex(safeSites);
  const sources = { tracker: safeTracker, requisitions: safeRequisitions, sites: safeSites, calendarEvents: safeEvents, candidateRowsById, calendarById, facilityIndex, workflowRules, now: current };
  const items = [];
  const futureTransitions = [];

  safeTracker.filter(activeCandidate).forEach((candidate) => {
    const candidateId = text(candidate.id);
    if (!candidateId) return;
    const requisitionResolution = activeExactRequisitionForCandidate(candidate, safeRequisitions);
    if (requisitionResolution.status !== "resolved") return;
    const requisition = requisitionResolution.requisition;
    const facilityResolution = canonicalFacilityForSource({ candidate, requisition, sites: safeSites, facilityIndex });
    if (facilityResolution.status !== "resolved") {
      const issueCode = facilityResolution.status === "disagreement"
        ? "facility-disagreement"
        : facilityResolution.status === "ambiguous"
          ? "facility-ambiguous"
          : "facility-unmapped";
      const context = contextFor(candidate, requisition, {});
      items.push(stableActionItem({
        category: ACTION_CENTER_CATEGORIES.dataBlocker,
        sourceType: "candidate",
        sourceId: candidateId,
        candidateId,
        requisitionId: text(requisition.id || requisition.requisitionId),
        title: facilityResolution.status === "disagreement" ? "Candidate and requisition facility context disagree" : facilityResolution.status === "ambiguous" ? "Facility identity is ambiguous" : "Facility could not be mapped",
        explanation: "The candidate and exact active requisition do not resolve to one canonical facility. Operational actions remain unavailable until the facility context is corrected.",
        recommendedAction: "Review the candidate facility assignment",
        destination: destinationFor("candidate", candidateId, text(requisition.id || requisition.requisitionId)),
        priorityScore: 88,
        riskLevel: "High",
        context,
        missingData: [issueCode],
        issueCode,
      }));
      return;
    }
    const facility = facilityResolution.facility;
    const context = contextFor(candidate, requisition, facility);
    const task = taskByCandidateRequisition.get(taskKey(candidateId, context.requisitionId));
    const feedbackState = managerFeedbackState(candidate, task, current, workflowRules);
    const readyPackagePending = candidateReadyPending(candidate, requisition, facility);
    if (feedbackState) {
      const elapsedHours = Math.max(0, Math.floor(feedbackState.elapsed || 0));
      const remainingHours = feedbackState.elapsed == null ? null : Math.max(0, Math.ceil(feedbackState.threshold - feedbackState.elapsed));
      const title = feedbackState.overdue ? `Manager feedback overdue for ${context.candidate}` : `Manager feedback pending for ${context.candidate}`;
      const explanation = feedbackState.overdue
        ? `${context.candidate}'s interview was recorded ${Math.max(1, elapsedHours)} hours ago, and manager feedback is overdue.`
        : feedbackState.completionConfirmed
          ? `${context.candidate}'s interview is complete, and manager feedback is pending${remainingHours == null ? "" : ` for ${elapsedHours} hours with ${remainingHours} hours remaining before escalation`}.`
          : `A manager feedback task is recorded for ${context.candidate}, and feedback is pending.`;
      items.push(stableActionItem({
        category: ACTION_CENTER_CATEGORIES.managerFeedback,
        sourceType: "candidate",
        sourceId: candidateId,
        candidateId,
        requisitionId: context.requisitionId,
        facilityId: context.facilityId,
        title,
        explanation,
        recommendedAction: "Review manager feedback follow-up",
        destination: destinationFor("candidate", candidateId, context.requisitionId),
        priorityScore: feedbackState.overdue ? 80 + Math.min(20, Math.floor((feedbackState.elapsed || 0) / 24) * 5) : 52,
        riskLevel: feedbackState.overdue ? "High" : "Medium",
        dueAt: task?.dueAt || feedbackState.interviewAt,
        context,
        missingData: context.requisitionId && context.facilityId ? [] : [!context.requisitionId ? "requisition" : "", !context.facilityId ? "facility" : ""].filter(Boolean),
        transitionAt: feedbackState.transitionAt,
      }));
    } else if (followUpDue(candidate, task, current, workflowRules, feedbackState, readyPackagePending)) {
      items.push(stableActionItem({
        category: ACTION_CENTER_CATEGORIES.followUp,
        sourceType: "candidate",
        sourceId: candidateId,
        candidateId,
        requisitionId: context.requisitionId,
        facilityId: context.facilityId,
        title: `Recruiter follow-up due for ${context.candidate}`,
        explanation: task?.reason || `The recruiter-owned follow-up for ${context.candidate} is due.`,
        recommendedAction: "Review candidate follow-up",
        destination: destinationFor("candidate", candidateId, context.requisitionId),
        priorityScore: 60 + (task?.isOverdue ? 15 : 0) + (["High", "Critical"].includes(task?.riskLevel) ? 15 : 0),
        riskLevel: ["High", "Critical"].includes(task?.riskLevel) ? task.riskLevel : task?.isOverdue ? "High" : "Medium",
        dueAt: task?.dueAt,
        context,
        missingData: context.requisitionId ? [] : ["requisition"],
      }));
    } else {
      const futureFollowUp = futureFollowUpEligibilityAt(candidate, task, current, workflowRules, feedbackState, readyPackagePending);
      if (futureFollowUp) futureTransitions.push(futureFollowUp);
    }

    if (readyPackagePending) {
      items.push(stableActionItem({
        category: ACTION_CENTER_CATEGORIES.candidateReady,
        sourceType: "candidate",
        sourceId: candidateId,
        candidateId,
        requisitionId: context.requisitionId,
        facilityId: context.facilityId,
        title: `Candidate Ready submission pending for ${context.candidate}`,
        explanation: `The reviewed Candidate Ready package exists for ${context.candidate}, but the matching facility submission has not been recorded as sent.`,
        recommendedAction: "Review Candidate Ready package",
        destination: destinationFor("candidate", candidateId, context.requisitionId),
        priorityScore: 72,
        riskLevel: "Medium",
        context,
        missingData: context.requisitionId && context.facilityId ? [] : [!context.requisitionId ? "requisition" : "", !context.facilityId ? "facility" : ""].filter(Boolean),
      }));
    }
  });

  workspace.reportReadiness.issues.forEach((issue) => {
    items.push(...itemsForReadinessIssue(issue, sources));
  });
  items.push(...contactBlockers(sources));

  const uniqueItems = [...items.reduce((result, item) => {
    const currentItem = result.get(item.id);
    if (!currentItem || item.priorityScore > currentItem.priorityScore) result.set(item.id, item);
    return result;
  }, new Map()).values()].sort((a, b) => b.priorityScore - a.priorityScore || a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
  const counts = ACTION_CENTER_FILTERS.reduce((result, filter) => ({
    ...result,
    [filter]: filter === ACTION_CENTER_CATEGORIES.all ? uniqueItems.length : uniqueItems.filter((item) => item.category === filter).length,
  }), {});
  const nextRefreshAt = [
    ...uniqueItems.map((item) => parseDate(item.transitionAt)),
    ...futureTransitions,
  ].filter((value) => value && value > current).sort((a, b) => a - b)[0];
  return { items: uniqueItems, counts, calculatedAt: current.toISOString(), nextRefreshAt: nextRefreshAt ? nextRefreshAt.toISOString() : "", readOnly: true };
}

export function filterRecruiterActionCenter(items = [], filter = ACTION_CENTER_CATEGORIES.all) {
  if (!Array.isArray(items)) return [];
  return filter === ACTION_CENTER_CATEGORIES.all ? [...items] : items.filter((item) => item.category === filter);
}
