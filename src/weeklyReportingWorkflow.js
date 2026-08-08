const count = (value) => Math.max(0, Number(value) || 0);

export const WEEKLY_REPORTING_STEPS = Object.freeze([
  Object.freeze({
    key: "overview",
    label: "Overview",
    scope: "Activity recorded during the selected reporting period.",
  }),
  Object.freeze({
    key: "candidate-cleanup",
    label: "Candidate & ATS Cleanup",
    scope: "Candidates in the selected reporting period whose ATS or recruiting status requires review.",
  }),
  Object.freeze({
    key: "facility-readiness",
    label: "Facility Readiness",
    scope: "Canonical facilities with report-period activity or a required weekly reporting decision.",
  }),
  Object.freeze({
    key: "review-reports",
    label: "Review Reports",
    scope: "Reports within the facilities, audiences, and report types currently selected.",
  }),
  Object.freeze({
    key: "send-export",
    label: "Send & Export",
    scope: "Only selected reports currently eligible for the chosen download or sending action.",
  }),
]);

export const LEGACY_WEEKLY_REPORTING_STEP_MAP = Object.freeze({
  metrics: "overview",
  ats: "candidate-cleanup",
  facility: "facility-readiness",
  audience: "review-reports",
  exports: "send-export",
});

export const RESTART_WEEKLY_REVIEW_CONFIRMATION = "Restarting will clear the current weekly report selections, previews, temporary weekly decisions, and report-session progress. Candidate, requisition, facility, contact, history, and saved workspace records will not be deleted.";

export function createWeeklyReviewSessionReset() {
  return {
    completedFacilityReports: {},
    noOpeningWeeklyDecisions: {},
    selectedFacilityReports: [],
    excludedReportIds: [],
    generatedReportPreview: "",
    weeklyReport: "",
    weeklySubject: "Weekly Active Candidate Report",
    activeReportSection: "submitted",
    reportsTab: "overview",
  };
}

const stepKeys = new Set(WEEKLY_REPORTING_STEPS.map((step) => step.key));

export function normalizeWeeklyReportingStep(value) {
  const key = String(value ?? "").trim();
  if (stepKeys.has(key)) return key;
  return LEGACY_WEEKLY_REPORTING_STEP_MAP[key] || "overview";
}

export function resolveReportingNavigation(value) {
  const key = String(value ?? "").trim();
  if (key === "hub" || key === "reporting" || key === "reports-history") {
    return { destination: "reporting", step: "overview" };
  }
  return { destination: "reports", step: normalizeWeeklyReportingStep(key) };
}

export function weeklyReportingStepNumber(value) {
  const key = normalizeWeeklyReportingStep(value);
  const index = WEEKLY_REPORTING_STEPS.findIndex((step) => step.key === key);
  return index + 1;
}

export function weeklyReportingScopeText(value) {
  const key = normalizeWeeklyReportingStep(value);
  return WEEKLY_REPORTING_STEPS.find((step) => step.key === key)?.scope || WEEKLY_REPORTING_STEPS[0].scope;
}

export function summarizeWeeklyReportingRows(rows = []) {
  const safeRows = Array.isArray(rows) ? rows : [];
  return safeRows.reduce((summary, row) => {
    const status = String(row?.status ?? "").trim();
    const readiness = String(row?.readiness ?? "").trim();
    if (status === "Reviewed") summary.reviewed += 1;
    else if (!["Sent", "Needs Review", "Blocked", "No Report Required"].includes(status) && (status === "Ready" || status === "Ready to Send" || readiness === "Ready")) summary.ready += 1;
    return summary;
  }, { ready: 0, reviewed: 0 });
}

export function selectWeeklyReportingPrimaryAction({
  blockerCount = 0,
  candidateCleanupCount = 0,
  readyReportCount = 0,
  reviewedReportCount = 0,
} = {}) {
  const blockers = count(blockerCount);
  const candidateUpdates = count(candidateCleanupCount);
  const readyReports = count(readyReportCount);
  const reviewedReports = count(reviewedReportCount);

  if (blockers) {
    return {
      label: `Continue: Fix ${blockers} Blocker${blockers === 1 ? "" : "s"}`,
      targetStep: "facility-readiness",
      count: blockers,
      disabled: false,
      reason: "Blocking reporting issues must be resolved before final output.",
    };
  }
  if (candidateUpdates) {
    return {
      label: `Review ${candidateUpdates} Candidate Update${candidateUpdates === 1 ? "" : "s"}`,
      targetStep: "candidate-cleanup",
      count: candidateUpdates,
      disabled: false,
      reason: "Candidate or ATS records require review for the selected reporting period.",
    };
  }
  if (readyReports) {
    return {
      label: `Review ${readyReports} Ready Report${readyReports === 1 ? "" : "s"}`,
      targetStep: "review-reports",
      count: readyReports,
      disabled: false,
      reason: "Eligible reports are ready for recruiter review.",
    };
  }
  if (reviewedReports) {
    return {
      label: `Send or Export ${reviewedReports} Report${reviewedReports === 1 ? "" : "s"}`,
      targetStep: "send-export",
      count: reviewedReports,
      disabled: false,
      reason: "Reviewed reports are ready for final handling.",
    };
  }
  return {
    label: "View Weekly Summary",
    targetStep: "overview",
    count: 0,
    disabled: false,
    reason: "No remaining reporting action is currently identified.",
  };
}

export function confirmWeeklyReviewRestart(confirmAction, restartAction) {
  if (typeof confirmAction !== "function" || typeof restartAction !== "function") return false;
  if (!confirmAction(RESTART_WEEKLY_REVIEW_CONFIRMATION)) return false;
  restartAction();
  return true;
}
