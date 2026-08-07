import { buildFacilityIndex, resolveCanonicalFacility, resolveRequisition } from "./weeklyCleanupReporting";
import { buildCalendarQueueTasks, calendarEventsMissingOutcomes } from "./internalCalendar";

const CLOSED_STATUSES = new Set(["archived", "closed", "hired", "placed", "rejected", "withdrew", "withdrawn"]);

export const DEFAULT_RECRUITER_WORKSPACE_RULES = Object.freeze({
  workspaceRiskInactivityDays: 7,
  workspaceFacilityReviewDelayHours: 72,
  workspaceInterviewDecisionDelayHours: 24,
  workspaceSourcingCoverageDays: 7,
  workspaceCriticalSourcingDays: 14,
  workspaceFocusMinutes: 60,
  workspaceStandardFocusMinutes: 30,
});

const text = (value) => String(value || "").trim();
const lower = (value) => text(value).toLowerCase();

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function hoursBetween(from, to) {
  const start = parseDate(from);
  const end = parseDate(to);
  if (!start || !end) return null;
  return Math.max(0, (end.getTime() - start.getTime()) / 3600000);
}

function numericRule(rules, key) {
  const value = Number(rules?.[key]);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_RECRUITER_WORKSPACE_RULES[key];
}

function resolvedRules(rules = {}) {
  return { ...DEFAULT_RECRUITER_WORKSPACE_RULES, ...(rules || {}) };
}

function lastActivityFor(item = {}) {
  const candidates = [
    item.lastActionAt,
    item.updatedAt,
    item.lastProfileUpdateAt,
    item.candidateFirstResponseAt,
    item.submittedToFacilityAt,
    item.candidateSubmittedToFacilityAt,
    item.submissionDate,
  ].map(parseDate).filter(Boolean);
  if (!candidates.length) return null;
  return new Date(Math.max(...candidates.map((date) => date.getTime()))).toISOString();
}

function candidateNameFor(item = {}) {
  return text(item.candidate || item.candidateName || item.formSnapshot?.fullName) || "Unnamed candidate";
}

function facilityNameFor(item = {}) {
  return text(item.site || item.facility || item.formSnapshot?.siteName) || "Facility not assigned";
}

function positionNameFor(item = {}) {
  return text(item.position || item.formSnapshot?.position) || "Position not assigned";
}

function activeCandidate(item = {}) {
  return !item.archived && !CLOSED_STATUSES.has(lower(item.status));
}

export function ownerForCandidate(item = {}) {
  if (text(item.ownerType || item.currentOwner)) return { type: text(item.ownerType || item.currentOwner), label: text(item.currentOwner || item.ownerType) };
  const haystack = lower(`${item.status} ${item.nextAction} ${item.waitingOn || ""}`);
  if (/candidate document|candidate response|candidate availability|awaiting candidate|background form/.test(haystack)) return { type: "Candidate", label: "Candidate" };
  if (/hiring manager|decision maker|facility feedback|manager review|request feedback|interview feedback/.test(haystack)) return { type: "Hiring Manager", label: "Hiring Manager" };
  if (/regional/.test(haystack)) return { type: "Regional Leader", label: "Regional Leader" };
  if (/credential/.test(haystack)) return { type: "Credentialing", label: "Credentialing" };
  if (/background/.test(haystack)) return { type: "Background Team", label: "Background Team" };
  if (/new hire liaison|liaison/.test(haystack)) return { type: "New Hire Liaison", label: "New Hire Liaison" };
  if (/onboard|orientation/.test(haystack)) return { type: "Onboarding", label: "Onboarding" };
  if (/\bhr\b|offer letter|offer processing/.test(haystack)) return { type: "HR", label: "HR" };
  if (/requisition|missing req|facility setup|position setup/.test(haystack)) return { type: "System or Requisition Issue", label: "System / Requisition" };
  return { type: "Recruiter", label: text(item.recruiterOwner || item.formSnapshot?.recruiterOwner) || "Recruiter" };
}

export function candidateRiskForWorkspace(item = {}, now = new Date(), rules = DEFAULT_RECRUITER_WORKSPACE_RULES) {
  if (!activeCandidate(item)) return { level: "Low", reason: "Candidate is no longer in an active workflow.", points: 0 };
  const lastActivity = lastActivityFor(item);
  if (item.riskOverride === "Not at risk" && (!lastActivity || !item.riskOverrideAt || new Date(item.riskOverrideAt) >= new Date(lastActivity))) {
    return { level: "Low", reason: text(item.riskOverrideNote) || "Recruiter reviewed this candidate and marked the current risk resolved.", points: 0, overridden: true };
  }
  const nowIso = now.toISOString();
  const activityAt = lastActivityFor(item);
  const inactiveHours = hoursBetween(activityAt, nowIso);
  const submittedAt = item.candidateSubmittedToFacilityAt || item.submittedToFacilityAt || item.facilitySubmittedAt || item.submissionDate;
  const submittedHours = hoursBetween(submittedAt, nowIso);
  const interviewAt = item.actualInterviewAt || (lower(item.status) === "interview completed" ? item.interviewDate : "");
  const interviewHours = hoursBetween(interviewAt, nowIso);
  const concerns = lower(`${item.candidateNotes || ""} ${item.notes || ""} ${item.riskReason || ""}`);
  const reasons = [];
  let points = 0;

  const inactivityHours = numericRule(rules, "workspaceRiskInactivityDays") * 24;
  const facilityDelayHours = numericRule(rules, "workspaceFacilityReviewDelayHours");
  const interviewDelayHours = numericRule(rules, "workspaceInterviewDecisionDelayHours");
  if (inactiveHours != null && inactiveHours >= inactivityHours) { points += 2; reasons.push(`${Math.floor(inactiveHours / 24)} days without recorded activity`); }
  if (submittedHours != null && submittedHours >= facilityDelayHours && !/interview|offer|hired/.test(lower(item.status))) { points += submittedHours >= facilityDelayHours * 2 ? 2 : 1; reasons.push("facility review has not produced a recorded next step"); }
  if (interviewHours != null && interviewHours >= interviewDelayHours && !/offer|hired|rejected/.test(lower(item.status))) { points += interviewHours >= interviewDelayHours * 3 ? 2 : 1; reasons.push("interview follow-up is overdue"); }
  if (/withdraw|repeated|no update|pay concern|schedule concern|location concern/.test(concerns)) { points += 2; reasons.push("candidate concern or disengagement signal is recorded"); }
  if (/offer accepted|verbal offer/.test(lower(item.status)) && !item.startDate && !item.tentativeStartDate) { points += 1; reasons.push("accepted offer has no recorded start date"); }

  const level = points >= 4 ? "Critical" : points >= 2 ? "High" : points === 1 ? "Medium" : "Low";
  return { level, reason: reasons.join("; ") || "No current risk trigger was found.", points };
}

function dueDateFor(item = {}) {
  return item.nextActionDueDate || item.facilityFeedbackNextDueAt || item.expectedResponseDate || item.interviewDate || item.tentativeStartDate || item.startDate || "";
}

function taskCategoryFor(item = {}, owner = ownerForCandidate(item), risk = candidateRiskForWorkspace(item)) {
  const haystack = lower(`${item.status} ${item.nextAction}`);
  if (["Critical", "High"].includes(risk.level)) return "Candidate Rescue";
  if (owner.type !== "Recruiter" && owner.type !== "System or Requisition Issue") return "Waiting on Others";
  if (/offer/.test(haystack)) return "Offers";
  if (/hired|onboard|orientation|background|credential/.test(haystack)) return "Onboarding";
  if (/stuck|escalat|overdue|missing|correct/.test(haystack)) return "Stuck";
  return "Do Now";
}

function taskFiltersFor(item = {}, owner, risk, primaryCategory, isOverdue) {
  const haystack = lower(`${item.status} ${item.nextAction}`);
  const filters = new Set([primaryCategory]);
  if (["Critical", "High"].includes(risk.level)) filters.add("Candidate Rescue");
  if (owner.type !== "Recruiter" && owner.type !== "System or Requisition Issue") filters.add("Waiting on Others");
  if (/offer/.test(haystack)) filters.add("Offers");
  if (/hired|onboard|orientation|background|credential/.test(haystack)) filters.add("Onboarding");
  if (isOverdue || /stuck|escalat|overdue|missing|correct/.test(haystack)) filters.add("Stuck");
  if (owner.type === "Recruiter" && !filters.has("Offers") && !filters.has("Onboarding")) filters.add("Do Now");
  return [...filters];
}

function reasonForTask(item = {}, owner, risk, now = new Date()) {
  if (["Critical", "High"].includes(risk.level)) return risk.reason;
  const due = parseDate(dueDateFor(item));
  if (due && due < now) return `${text(item.nextAction || item.status) || "Next action"} is overdue.`;
  if (owner.type !== "Recruiter") return `The next recorded step is controlled by ${owner.label}.`;
  return text(item.nextAction) ? `Next recorded action: ${item.nextAction}.` : `The active candidate does not have a clear next action.`;
}

function priorityFor(task) {
  if (task.riskLevel === "Critical") return 0;
  if (task.riskLevel === "High") return 1;
  if (task.isOverdue) return 2;
  if (task.ownerType === "Recruiter") return 3;
  return 4;
}

export function scoreWorkspaceTask(task = {}) {
  const reasons = [];
  let score = 0;
  const riskPoints = { Critical: 50, High: 35, Medium: 15, Low: 0 };
  score += riskPoints[task.riskLevel] || 0;
  if (riskPoints[task.riskLevel]) reasons.push(`${task.riskLevel.toLowerCase()} candidate or requisition risk`);
  if (task.isOverdue) { score += 25; reasons.push("past its recorded due point"); }
  if (task.daysWaiting > 0) {
    score += Math.min(15, Number(task.daysWaiting));
    reasons.push(`${task.daysWaiting} day${task.daysWaiting === 1 ? "" : "s"} waiting`);
  }
  if (task.ownerType === "Recruiter") { score += 10; reasons.push("recruiter owns the next action"); }
  if (task.sourceType === "requisition") {
    const openings = Math.max(0, Number(task.openings || 0));
    if (openings) { score += Math.min(15, openings * 3); reasons.push(`${openings} open role${openings === 1 ? "" : "s"}`); }
    if (!Number(task.activeCandidateCount || 0)) { score += 20; reasons.push("no active candidate coverage"); }
    const businessPriority = lower(task.requisitionPriority);
    if (/critical|urgent|high/.test(businessPriority)) { score += 15; reasons.push(`${task.requisitionPriority} business priority`); }
  }
  return { score, reasons };
}

export function buildCandidateWorkspaceTasks(tracker = [], options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const rules = resolvedRules(options.rules);
  return tracker.filter((item) => activeCandidate(item)
    && !(item.snoozedUntil && new Date(item.snoozedUntil) > now)
    && !(item.taskStatus === "Completed" && String(item.completedAt || "").slice(0, 10) === now.toISOString().slice(0, 10))).map((item) => {
    const owner = ownerForCandidate(item);
    const risk = candidateRiskForWorkspace(item, now, rules);
    const dueAt = dueDateFor(item);
    const due = parseDate(dueAt);
    const activityAt = lastActivityFor(item);
    const waitingHours = hoursBetween(item.waitingSince || activityAt || item.submissionDate, now.toISOString());
    const category = taskCategoryFor(item, owner, risk);
    const isOverdue = Boolean(due && due < now);
    const task = {
      id: `candidate:${item.id || candidateNameFor(item)}`,
      sourceType: "candidate",
      sourceId: item.id || "",
      candidateId: item.id || "",
      requisitionId: item.requisitionId || item.selectedRequisitionId || item.formSnapshot?.selectedRequisitionId || "",
      candidateName: candidateNameFor(item),
      position: positionNameFor(item),
      facilityName: facilityNameFor(item),
      title: text(item.nextAction) || "Define next candidate action",
      ownerType: owner.type,
      ownerLabel: owner.label,
      riskLevel: risk.level,
      riskReason: risk.reason,
      category,
      filters: taskFiltersFor(item, owner, risk, category, isOverdue),
      dueAt,
      isOverdue,
      daysWaiting: waitingHours == null ? null : Math.floor(waitingHours / 24),
      estimatedMinutes: /email|text|reminder|follow up/.test(lower(item.nextAction)) ? 10 : 15,
      recommendedAction: text(item.nextAction) || "Open the candidate and assign a next action",
      reportImpact: !text(item.candidateNotes) || !text(item.nextAction) ? "Needs review" : "Complete",
    };
    const scored = scoreWorkspaceTask(task);
    return { ...task, reason: reasonForTask(item, owner, risk, now), priority: priorityFor(task), priorityScore: scored.score, priorityReasons: scored.reasons };
  }).sort((a, b) => b.priorityScore - a.priorityScore || a.priority - b.priority || (b.daysWaiting || 0) - (a.daysWaiting || 0));
}

export function buildRequisitionWorkspaceTasks(requisitions = [], tracker = [], options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const rules = resolvedRules(options.rules);
  const coverageDays = numericRule(rules, "workspaceSourcingCoverageDays");
  const criticalDays = numericRule(rules, "workspaceCriticalSourcingDays");
  return requisitions.filter((req) => lower(req.status || "active") === "active").flatMap((req) => {
    const reqId = req.id || req.requisitionId || "";
    const matches = tracker.filter((candidate) => activeCandidate(candidate) && (
      (reqId && [candidate.requisitionId, candidate.selectedRequisitionId, candidate.formSnapshot?.selectedRequisitionId].includes(reqId)) ||
      (text(req.reqNumber) && text(candidate.reqNumber || candidate.formSnapshot?.reqNumber) === text(req.reqNumber))
    ));
    const lastSubmission = matches.map((item) => parseDate(item.submissionDate || item.submittedToFacilityAt)).filter(Boolean).sort((a, b) => b - a)[0] || parseDate(req.openDate);
    const daysWithoutSubmission = lastSubmission ? Math.floor((now.getTime() - lastSubmission.getTime()) / 86400000) : null;
    const openings = Number(req.openings || req.numberOfOpenings || 1);
    if (matches.length && (daysWithoutSubmission == null || daysWithoutSubmission < coverageDays)) return [];
    const task = {
      id: `requisition:${reqId || req.reqNumber || req.positionTitle}`,
      sourceType: "requisition",
      sourceId: reqId,
      requisitionId: reqId,
      candidateName: text(req.positionTitle) || "Open requisition",
      position: text(req.positionTitle) || "Position not assigned",
      facilityName: text(req.siteName) || "Facility not assigned",
      title: "Recruiting coverage needed",
      category: "Recruiting Needed",
      filters: ["Recruiting Needed", ...(daysWithoutSubmission != null && daysWithoutSubmission >= coverageDays ? ["Stuck"] : [])],
      ownerType: "Recruiter",
      ownerLabel: text(req.recruiterOwner) || "Recruiter",
      riskLevel: daysWithoutSubmission != null && daysWithoutSubmission >= criticalDays ? "High" : "Medium",
      riskReason: matches.length ? `No recorded submission in ${daysWithoutSubmission} days.` : "No active candidates are connected to this requisition.",
      reason: matches.length ? `This requisition has ${openings} opening${openings === 1 ? "" : "s"} and no recorded submission in ${daysWithoutSubmission} days.` : `This requisition has ${openings} opening${openings === 1 ? "" : "s"} and no active candidate coverage.`,
      dueAt: "",
      isOverdue: Boolean(daysWithoutSubmission != null && daysWithoutSubmission >= coverageDays),
      daysWaiting: daysWithoutSubmission,
      estimatedMinutes: 60,
      recommendedAction: "Start a focused sourcing session",
      reportImpact: "Complete",
      openings,
      activeCandidateCount: matches.length,
      shift: text(req.shiftPreference || req.shift),
      employmentType: text(req.employmentType),
      schedule: text(req.workSchedule),
      pay: text(req.payNotes || req.rate || req.compensation),
      requiredCredentials: text(req.requiredCredentials || req.credentialType),
      requisitionPriority: text(req.requisitionPriority || req.priority),
      priority: daysWithoutSubmission != null && daysWithoutSubmission >= criticalDays ? 1 : 3,
    };
    const scored = scoreWorkspaceTask(task);
    return [{ ...task, priorityScore: scored.score, priorityReasons: scored.reasons }];
  }).sort((a, b) => b.priorityScore - a.priorityScore || a.priority - b.priority || (b.daysWaiting || 0) - (a.daysWaiting || 0));
}

function healthStatus(percent) {
  if (percent >= 90) return "Healthy";
  if (percent >= 75) return "Good";
  if (percent >= 55) return "Needs Attention";
  if (percent >= 30) return "At Risk";
  return "Critical";
}

function healthFrom(total, issues) {
  if (!total) return { status: "Not enough data", percent: null, issues };
  const percent = Math.max(0, Math.round(((total - Math.min(total, issues)) / total) * 100));
  return { status: healthStatus(percent), percent, issues };
}

export function buildWorkspaceHealth({ tracker = [], tasks = [], requisitions = [] } = {}) {
  const active = tracker.filter(activeCandidate);
  const byOwner = (type) => tasks.filter((task) => task.ownerType === type).length;
  const byText = (pattern) => active.filter((item) => pattern.test(lower(`${item.status} ${item.nextAction}`))).length;
  const sourcingTasks = tasks.filter((task) => task.filters.includes("Recruiting Needed")).length;
  const reportIssues = tasks.filter((task) => task.reportImpact === "Needs review").length;
  return {
    candidateFollowUp: healthFrom(active.length, byOwner("Candidate") + tasks.filter((task) => ["High", "Critical"].includes(task.riskLevel)).length),
    hiringManagerResponse: healthFrom(active.length, byOwner("Hiring Manager")),
    sourcingCoverage: healthFrom(Math.max(1, requisitions.filter((req) => lower(req.status || "active") === "active").length), sourcingTasks),
    offerProcess: healthFrom(byText(/offer/), tasks.filter((task) => task.filters.includes("Offers") && task.isOverdue).length),
    newHireCare: healthFrom(byText(/hired|onboard|orientation|background/), tasks.filter((task) => task.filters.includes("Onboarding") && task.isOverdue).length),
    reportingReadiness: healthFrom(active.length, reportIssues),
  };
}

function reportIssue(code, label, sourceType, sourceId, fixLocation) {
  return { code, label, sourceType, sourceId: text(sourceId), fixLocation };
}

function hasStartDate(item = {}) {
  return Boolean(text(item.startDate || item.confirmedStartDate || item.tentativeStartDate || item.formSnapshot?.startDateAvailability));
}

function needsOutcome(item = {}) {
  return Boolean(item.archived || CLOSED_STATUSES.has(lower(item.status)));
}

export function buildWorkspaceReportReadiness({ tracker = [], requisitions = [], sites = [], tasks = [], calendarEvents = [], now = new Date() } = {}) {
  const issues = [];
  let checks = 0;
  let completed = 0;
  const facilityIndex = buildFacilityIndex(sites);
  const riskByCandidate = new Map(tasks.filter((task) => task.sourceType === "candidate").map((task) => [task.sourceId, task]));
  const check = (condition, issue) => {
    checks += 1;
    if (condition) completed += 1;
    else issues.push(issue);
  };

  tracker.forEach((item) => {
    const id = item.id || candidateNameFor(item);
    const task = riskByCandidate.get(item.id);
    const reqResolution = resolveRequisition(item, requisitions);
    const facilityResolution = resolveCanonicalFacility({ candidate: item, requisition: reqResolution.requisition, sites, facilityIndex });
    check(Boolean(text(item.nextAction)) || !activeCandidate(item), reportIssue("missing-next-action", "Next action is missing", "candidate", id, "Candidate Management"));
    check(Boolean(text(item.candidateNotes || item.notes)), reportIssue("missing-candidate-notes", "Candidate notes are missing", "candidate", id, "Candidate Profile"));
    check(Boolean(text(item.currentOwner || item.ownerType || item.recruiterOwner || item.formSnapshot?.recruiterOwner)), reportIssue("unresolved-ownership", "Current next-step owner is unresolved", "candidate", id, "Candidate Management"));
    check(Boolean(lastActivityFor(item)), reportIssue("missing-activity-date", "Last activity date is missing", "candidate", id, "Candidate Timeline"));
    check(!task || !["High", "Critical"].includes(task.riskLevel) || Boolean(text(item.riskReason || task.riskReason)), reportIssue("missing-risk-explanation", "High-risk candidate needs a risk explanation", "candidate", id, "Candidate Management"));
    check(!/offer|hired|onboard|background|orientation/.test(lower(`${item.status} ${item.nextAction}`)) || hasStartDate(item), reportIssue("missing-start-date", "Offer or onboarding record needs a start date", "candidate", id, "Candidate Profile"));
    check(facilityResolution.status === "resolved", reportIssue(facilityResolution.status === "ambiguous" ? "facility-ambiguous" : "facility-unmapped", facilityResolution.status === "ambiguous" ? "Facility identity is ambiguous" : "Facility could not be mapped", "candidate", id, "Facility & Position Setup"));
    check(reqResolution.status === "resolved", reportIssue("missing-requisition-id", "Candidate is not connected to one current requisition", "candidate", id, "Candidate Intake"));
    check(!needsOutcome(item) || Boolean(text(item.archiveOutcome || item.disposition || item.outcome || item.archiveReason)), reportIssue("unclassified-outcome", "Closed candidate outcome is not classified", "candidate", id, "Candidate Management"));
  });

  requisitions.forEach((req) => {
    const id = req.id || req.requisitionId || req.reqNumber || req.positionTitle;
    const facilityResolution = resolveCanonicalFacility({ requisition: req, sites, facilityIndex });
    check(Boolean(text(req.id || req.requisitionId)), reportIssue("missing-requisition-id", "Requisition stable ID is missing", "requisition", id, "Facility & Position Setup"));
    check(Boolean(text(req.reqNumber || req.uniqueIdNumber)), reportIssue("missing-requisition-number", "Req Number or Unique ID is missing", "requisition", id, "Facility & Position Setup"));
    check(Boolean(text(req.positionTitle)), reportIssue("missing-position", "Requisition position is missing", "requisition", id, "Facility & Position Setup"));
    check(facilityResolution.status === "resolved", reportIssue(facilityResolution.status === "ambiguous" ? "facility-ambiguous" : "facility-unmapped", "Requisition facility needs reconciliation", "requisition", id, "Facility & Position Setup"));
  });
  calendarEventsMissingOutcomes(calendarEvents, now).forEach((event) => {
    check(false, reportIssue("calendar-outcome-missing", `${event.eventType} is missing an outcome`, "calendar", event.id, "Calendar"));
  });

  const count = (codes) => issues.filter((issue) => codes.includes(issue.code)).length;
  const percent = checks ? Math.round((completed / checks) * 100) : null;
  return {
    percent,
    autoComplete: completed,
    requiresReview: issues.length,
    totalChecks: checks,
    issues,
    missingNotes: count(["missing-candidate-notes"]),
    missingNextActions: count(["missing-next-action"]),
    missingRiskExplanations: count(["missing-risk-explanation"]),
    missingStartDates: count(["missing-start-date"]),
    facilityIssues: count(["facility-unmapped", "facility-ambiguous"]),
    requisitionIssues: count(["missing-requisition-id", "missing-requisition-number", "missing-position"]),
    unresolvedOwnership: count(["unresolved-ownership"]),
    unclassifiedOutcomes: count(["unclassified-outcome"]),
    calendarEventsMissingOutcomes: count(["calendar-outcome-missing"]),
  };
}

function sameUtcDay(value, now) {
  const date = parseDate(value);
  return Boolean(date && date.toISOString().slice(0, 10) === now.toISOString().slice(0, 10));
}

function tomorrowUtcDay(now) {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function buildWrapUpSummary({ tracker = [], history = [], tasks = [], reportReadiness = {}, calendarEvents = [], now = new Date() } = {}) {
  const historyToday = history.filter((entry) => sameUtcDay(entry.timestamp || entry.createdAt || entry.date, now));
  const completedRecords = tracker.filter((item) => sameUtcDay(item.completedAt || item.focusCompletedAt, now));
  const completedIds = new Set([...historyToday.map((entry) => entry.id || `${entry.type}:${entry.timestamp}`), ...completedRecords.map((item) => item.id)]);
  const focusMinutes = historyToday.filter((entry) => /Recruiting Focus Session Completed/i.test(text(entry.type || entry.label))).reduce((sum, entry) => sum + Number(entry.meta?.minutes || entry.minutes || 0), 0);
  return {
    actionsCompleted: completedIds.size,
    remainingUrgent: tasks.filter((task) => task.isOverdue || ["High", "Critical"].includes(task.riskLevel)).length,
    waitingOnOthers: tasks.filter((task) => task.filters.includes("Waiting on Others")).length,
    followUpsTomorrow: tracker.filter((item) => text(item.nextActionDueDate).slice(0, 10) === tomorrowUtcDay(now)).length,
    recruitingMinutesCompleted: focusMinutes,
    candidateRisksRemaining: tasks.filter((task) => task.filters.includes("Candidate Rescue")).length,
    reportReadiness: reportReadiness.percent,
    tasksWithoutOwnerOrDueDate: tasks.filter((task) => !text(task.ownerType) || !text(task.dueAt)).length,
    eventsMissingOutcomes: calendarEventsMissingOutcomes(calendarEvents, now).length,
  };
}

export function buildRecruiterWorkspaceModel({ tracker = [], requisitions = [], sites = [], history = [], calendarEvents = [], rules = {}, now = new Date() } = {}) {
  const normalizedRules = resolvedRules(rules);
  const candidateTasks = buildCandidateWorkspaceTasks(tracker, { now, rules: normalizedRules });
  const requisitionTasks = buildRequisitionWorkspaceTasks(requisitions, tracker, { now, rules: normalizedRules });
  const calendarTasks = buildCalendarQueueTasks(calendarEvents, now);
  const tasks = [...candidateTasks, ...requisitionTasks, ...calendarTasks].sort((a, b) => b.priorityScore - a.priorityScore || a.priority - b.priority || (b.daysWaiting || 0) - (a.daysWaiting || 0));
  const countFilter = (filter) => tasks.filter((task) => task.filters.includes(filter)).length;
  const reportReadiness = buildWorkspaceReportReadiness({ tracker, requisitions, sites, tasks, calendarEvents, now });
  const health = buildWorkspaceHealth({ tracker, tasks, requisitions });
  health.reportingReadiness = reportReadiness.percent == null
    ? { status: "Not enough data", percent: null, issues: 0 }
    : { status: healthStatus(reportReadiness.percent), percent: reportReadiness.percent, issues: reportReadiness.requiresReview };
  const focusTask = requisitionTasks[0] || null;
  const model = {
    tasks,
    rules: normalizedRules,
    plan: {
      rescue: countFilter("Candidate Rescue"),
      overdueDecisions: tasks.filter((task) => task.filters.includes("Waiting on Others") && task.isOverdue).length,
      submissions: tasks.filter((task) => task.filters.includes("Do Now") && /submit/.test(lower(task.recommendedAction))).length,
      newHireCheckIns: countFilter("Onboarding"),
      focusMinutes: focusTask ? numericRule(normalizedRules, "workspaceFocusMinutes") : requisitions.length ? numericRule(normalizedRules, "workspaceStandardFocusMinutes") : 0,
    },
    snapshot: {
      urgent: tasks.filter((task) => task.isOverdue || ["High", "Critical"].includes(task.riskLevel)).length,
      waiting: countFilter("Waiting on Others"),
      risks: countFilter("Candidate Rescue"),
      newHires: countFilter("Onboarding"),
      recruitingGoal: focusTask ? 0 : 100,
      reportReady: reportReadiness.percent,
    },
    health,
    focusTask,
    reportReadiness,
  };
  return { ...model, wrapUp: buildWrapUpSummary({ tracker, history, tasks, reportReadiness, calendarEvents, now }) };
}
