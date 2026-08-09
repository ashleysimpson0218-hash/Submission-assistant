import { resolveExactRequisition, resolveFacilitySubmissionRecipients } from "./communicationGeneration";
import { buildRecruiterWorkspaceModel } from "./recruiterWorkspaceSelectors";
import { ACTION_STATES, normalizeReviewedCommunicationRecord } from "./submissionCommunicationActions";
import { buildFacilityIndex, resolveCanonicalFacility } from "./weeklyCleanupReporting";

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
  "closed",
  "do not contact",
  "do-not-contact",
  "hired",
  "ineligible",
  "not interested",
  "placed",
  "rejected",
  "unresponsive",
  "withdrew",
  "withdrawn",
]);

const ACTIONABLE_READINESS_CODES = new Set([
  "calendar-outcome-missing",
  "facility-ambiguous",
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

function activeCandidate(candidate = {}) {
  return !candidate.archived && !TERMINAL_CANDIDATE_STATUSES.has(lower(candidate.status));
}

function activeRequisition(requisition = {}) {
  return !requisition.archived && !["archived", "closed", "filled", "inactive"].includes(lower(requisition.status));
}

function candidateName(candidate = {}) {
  return text(candidate.candidate || candidate.candidateName || candidate.formSnapshot?.fullName) || "Unnamed candidate";
}

function candidateRequisitionId(candidate = {}) {
  return text(candidate.requisitionId || candidate.selectedRequisitionId || candidate.formSnapshot?.selectedRequisitionId);
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
  const id = candidateRequisitionId(candidate);
  if (!id) return { requisition: null, status: "missing" };
  const resolution = resolveExactRequisition(requisitions, id);
  if (!resolution.value) {
    const ambiguous = resolution.blockers?.some((blocker) => blocker.code === "REQUISITION_AMBIGUOUS");
    return { requisition: null, status: ambiguous ? "ambiguous" : "unmapped" };
  }
  if (!activeRequisition(resolution.value) || lower(resolution.value.status) !== "active") {
    return { requisition: null, status: "inactive" };
  }
  return { requisition: resolution.value, status: "resolved" };
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
    requisitionId: text(requisition.id || requisition.requisitionId || candidateRequisitionId(candidate)),
    requisitionNumber: text(requisition.reqNumber || requisition.uniqueIdNumber || candidate.reqNumber || candidate.formSnapshot?.reqNumber),
    facility: text(facility.siteName || facility.facilityName) || "Facility unresolved",
    facilityId: text(facility.id || facility.facilityId),
    region: text(facility.regionName || facility.region),
    currentOwner: text(candidate.currentOwner || candidate.ownerType || candidate.recruiterOwner || candidate.formSnapshot?.recruiterOwner),
  };
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
}) {
  const target = text(sourceId || candidateId || requisitionId || facilityId || calendarEventId || "unresolved");
  const segment = (value) => encodeURIComponent(text(value) || "unresolved");
  const identity = sourceType === "candidate"
    ? `action-center-v1:${category}:candidate:${segment(candidateId || target)}:requisition:${segment(requisitionId)}`
    : `action-center-v1:${category}:${sourceType}:${segment(target)}`;
  return {
    id: `${identity}${issueCode ? `:${segment(issueCode)}` : ""}`,
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
    sideEffectClass: "read-only",
    approvalRequired: "Recruiter approval is required before any record or communication changes.",
  };
}

function managerFeedbackReceived(candidate = {}) {
  return Boolean(text(candidate.hiringDecisionReceivedAt
    || candidate.managerFeedbackReceivedAt
    || candidate.facilityFeedbackReceivedAt
    || candidate.interviewFeedback
    || candidate.interviewOutcome
    || candidate.finalCandidateOutcome))
    || /offer|hired|rejected|withdraw/.test(lower(candidate.status));
}

function managerFeedbackState(candidate, task, now, workflowRules) {
  if (managerFeedbackReceived(candidate)) return null;
  const explicit = /request feedback|interview feedback/.test(lower(candidate.nextAction));
  const completed = lower(candidate.status) === "interview completed" || Boolean(candidate.actualInterviewAt || candidate.interviewDate);
  if (!explicit && !completed && !(task?.ownerType === "Hiring Manager" && /feedback/.test(lower(task?.recommendedAction || task?.title)))) return null;
  const interviewAt = candidate.actualInterviewAt || candidate.interviewDate;
  const elapsed = hoursBetween(interviewAt, now);
  const threshold = Math.max(0, Number(workflowRules.interviewFeedbackHours || workflowRules.workspaceInterviewDecisionDelayHours || 24));
  return {
    elapsed,
    interviewAt: text(interviewAt),
    overdue: elapsed != null && elapsed >= threshold,
    threshold,
  };
}

function candidateReadyPending(candidate = {}) {
  if (!candidate.reviewedSubmissionPackage) return false;
  const normalized = normalizeReviewedCommunicationRecord(candidate);
  return normalized.communicationActionStates?.facilitySubmission !== ACTION_STATES.facilitySent
    && !candidate.facilitySubmissionSentAt;
}

function followUpDue(candidate, task, now, workflowRules, feedbackState = null) {
  if (!task || task.ownerType !== "Recruiter" || feedbackState || candidateReadyPending(candidate)) return false;
  const due = parseDate(task.dueAt);
  const lastActivity = candidateLastActivity(candidate);
  const inactiveHours = hoursBetween(lastActivity, now);
  const threshold = Math.max(1, Number(workflowRules.candidateFollowUpDays || 2)) * 24;
  const explicit = /follow.?up|check.?in|reach out|contact candidate|candidate update/.test(lower(candidate.nextAction));
  return Boolean((due && due <= now) || (explicit && (inactiveHours == null || inactiveHours >= threshold)));
}

function destinationFor(sourceType, sourceId) {
  if (!text(sourceId)) return { type: "unavailable", id: "", label: "Target unavailable", disabled: true, reason: "The affected record has no stable identifier." };
  if (sourceType === "candidate") return { type: "candidate", id: sourceId, label: "Open Candidate" };
  if (sourceType === "requisition") return { type: "requisition", id: sourceId, label: "Open Requisition" };
  if (sourceType === "facility") return { type: "facility", id: sourceId, label: "Open Facility" };
  if (sourceType === "calendar") return { type: "calendar", id: sourceId, label: "View Event" };
  return { type: "reporting", id: sourceId, label: "Open Weekly Reporting" };
}

function itemForReadinessIssue(issue, sources) {
  if (!ACTIONABLE_READINESS_CODES.has(issue.code)) return null;
  const sourceId = text(issue.sourceId);
  if (!sourceId) return null;
  const candidate = issue.sourceType === "candidate" ? sources.candidateById.get(sourceId) : null;
  const candidateRequisitionResolution = candidate ? activeExactRequisitionForCandidate(candidate, sources.requisitions) : { requisition: null, status: "not-applicable" };
  const requisition = issue.sourceType === "requisition"
    ? sources.requisitionById.get(sourceId) || sources.requisitions.find((entry) => text(entry.id || entry.requisitionId || entry.reqNumber || entry.positionTitle) === sourceId)
    : candidateRequisitionResolution.requisition;
  const calendarEvent = issue.sourceType === "calendar" ? sources.calendarById.get(sourceId) : null;
  if (issue.sourceType === "candidate" && (!candidate || !activeCandidate(candidate))) return null;
  if (issue.sourceType === "requisition" && (!requisition || !activeRequisition(requisition))) return null;
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
  } : contextFor(candidate || {}, requisition || {}, facility || {});
  const sourceType = issue.sourceType;
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
    destination: destinationFor(sourceType, sourceType === "requisition" ? context.requisitionId : sourceId),
    priorityScore: ["facility-ambiguous", "facility-unmapped", "missing-requisition-id"].includes(issue.code) ? 88 : 58,
    riskLevel: ["facility-ambiguous", "facility-unmapped", "missing-requisition-id"].includes(issue.code) ? "High" : "Medium",
    context,
    missingData: [issue.code],
    issueCode: issue.code,
  });
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
  const candidateById = new Map(safeTracker.map((candidate) => [text(candidate.id), candidate]).filter(([id]) => id));
  const requisitionById = new Map(safeRequisitions.flatMap((requisition) => [requisition.id, requisition.requisitionId].map(text).filter(Boolean).map((id) => [id, requisition])));
  const calendarById = new Map(safeEvents.map((event) => [text(event.id), event]).filter(([id]) => id));
  const facilityIndex = buildFacilityIndex(safeSites);
  const sources = { tracker: safeTracker, requisitions: safeRequisitions, sites: safeSites, calendarEvents: safeEvents, candidateById, requisitionById, calendarById, facilityIndex };
  const items = [];

  safeTracker.filter(activeCandidate).forEach((candidate) => {
    const candidateId = text(candidate.id);
    if (!candidateId) return;
    const requisitionResolution = activeExactRequisitionForCandidate(candidate, safeRequisitions);
    if (requisitionResolution.status !== "resolved") return;
    const requisition = requisitionResolution.requisition;
    const facilityResolution = canonicalFacilityForSource({ candidate, requisition, sites: safeSites, facilityIndex });
    if (facilityResolution.status !== "resolved") {
      const issueCode = facilityResolution.status === "ambiguous" ? "facility-ambiguous" : "facility-unmapped";
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
        destination: destinationFor("candidate", candidateId),
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
    if (feedbackState) {
      const elapsedHours = Math.max(0, Math.floor(feedbackState.elapsed || 0));
      const remainingHours = feedbackState.elapsed == null ? null : Math.max(0, Math.ceil(feedbackState.threshold - feedbackState.elapsed));
      const title = feedbackState.overdue ? `Manager feedback overdue for ${context.candidate}` : `Manager feedback pending for ${context.candidate}`;
      const explanation = feedbackState.overdue
        ? `${context.candidate}'s interview was recorded ${Math.max(1, elapsedHours)} hours ago, and manager feedback is overdue.`
        : `${context.candidate}'s interview is complete, and manager feedback is pending${remainingHours == null ? "" : ` for ${elapsedHours} hours with ${remainingHours} hours remaining before escalation`}.`;
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
        destination: destinationFor("candidate", candidateId),
        priorityScore: feedbackState.overdue ? 80 + Math.min(20, Math.floor((feedbackState.elapsed || 0) / 24) * 5) : 52,
        riskLevel: feedbackState.overdue ? "High" : "Medium",
        dueAt: task?.dueAt || feedbackState.interviewAt,
        context,
        missingData: context.requisitionId && context.facilityId ? [] : [!context.requisitionId ? "requisition" : "", !context.facilityId ? "facility" : ""].filter(Boolean),
      }));
    } else if (followUpDue(candidate, task, current, workflowRules, feedbackState)) {
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
        destination: destinationFor("candidate", candidateId),
        priorityScore: 60 + (task?.isOverdue ? 15 : 0) + (["High", "Critical"].includes(task?.riskLevel) ? 15 : 0),
        riskLevel: ["High", "Critical"].includes(task?.riskLevel) ? task.riskLevel : task?.isOverdue ? "High" : "Medium",
        dueAt: task?.dueAt,
        context,
        missingData: context.requisitionId ? [] : ["requisition"],
      }));
    }

    if (candidateReadyPending(candidate)) {
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
        destination: destinationFor("candidate", candidateId),
        priorityScore: 72,
        riskLevel: "Medium",
        context,
        missingData: context.requisitionId && context.facilityId ? [] : [!context.requisitionId ? "requisition" : "", !context.facilityId ? "facility" : ""].filter(Boolean),
      }));
    }
  });

  workspace.reportReadiness.issues.forEach((issue) => {
    const item = itemForReadinessIssue(issue, sources);
    if (item) items.push(item);
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
  return { items: uniqueItems, counts, calculatedAt: current.toISOString(), readOnly: true };
}

export function filterRecruiterActionCenter(items = [], filter = ACTION_CENTER_CATEGORIES.all) {
  if (!Array.isArray(items)) return [];
  return filter === ACTION_CENTER_CATEGORIES.all ? [...items] : items.filter((item) => item.category === filter);
}
