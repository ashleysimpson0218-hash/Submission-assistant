const text = (value) => String(value ?? "").trim();
const values = (value) => Array.isArray(value) ? value : [];

export const NO_OPENINGS_POLICIES = Object.freeze({
  AUTO_STANDARD_REPORT: "auto-standard-report",
  NO_REPORT_REQUIRED: "no-report-required",
  ASK_WEEKLY: "ask-weekly",
});

export const NO_OPENINGS_WEEKLY_DECISIONS = Object.freeze({
  CREATE_STANDARD_REPORT: "create-standard-report",
  NO_REPORT_NEEDED: "no-report-needed",
});

export const NO_OPENINGS_POLICY_OPTIONS = [
  {
    value: NO_OPENINGS_POLICIES.AUTO_STANDARD_REPORT,
    label: "Automatically create a standard report",
    description: "Prepare the standard no-openings report when the facility, recipient, and reporting checks pass.",
  },
  {
    value: NO_OPENINGS_POLICIES.NO_REPORT_REQUIRED,
    label: "Mark no-opening facilities as no report required",
    description: "Keep the facility visible for audit without adding it to required-report or sending work.",
  },
  {
    value: NO_OPENINGS_POLICIES.ASK_WEEKLY,
    label: "Ask me each week",
    description: "Require a current-session choice for each no-opening facility. The choice resets on reload.",
  },
];

const SUPPORTED_POLICIES = new Set(Object.values(NO_OPENINGS_POLICIES));
const STRUCTURAL_BLOCKER_CODES = new Set([
  "AMBIGUOUS_FACILITY",
  "UNMAPPED_FACILITY",
  "MISSING_FACILITY_ID",
  "MISSING_REQUISITION_ID",
  "AMBIGUOUS_REQUISITION",
]);

export function hasStandardNoOpeningsTemplate(settings = {}) {
  const automation = settings.options?.reportAutomation || {};
  const template = settings.templates?.noOpeningsWeeklyReport || {};
  return automation.useNoOpeningsTemplate !== false
    && Boolean(text(template.subject))
    && Boolean(text(template.body));
}

export function deriveNoOpeningsPolicy(settings = {}) {
  const automation = settings.options?.reportAutomation || {};
  const explicit = text(automation.noOpeningsPolicy);
  if (SUPPORTED_POLICIES.has(explicit)) return explicit;
  if (automation.includeNoOpeningFacilities === false) return NO_OPENINGS_POLICIES.NO_REPORT_REQUIRED;
  if (automation.includeNoOpeningFacilities === true && hasStandardNoOpeningsTemplate(settings)) {
    return NO_OPENINGS_POLICIES.AUTO_STANDARD_REPORT;
  }
  return NO_OPENINGS_POLICIES.ASK_WEEKLY;
}

export function settingsWithNoOpeningsPolicy(settings = {}, policy) {
  if (!SUPPORTED_POLICIES.has(policy)) return settings;
  return {
    ...settings,
    options: {
      ...(settings.options || {}),
      reportAutomation: {
        ...(settings.options?.reportAutomation || {}),
        noOpeningsPolicy: policy,
      },
    },
  };
}

export function updateWeeklyNoOpeningDecision(decisions = {}, facilityId, decision) {
  const key = text(facilityId);
  if (!key) return decisions;
  if (!Object.values(NO_OPENINGS_WEEKLY_DECISIONS).includes(decision)) return decisions;
  return { ...decisions, [key]: decision };
}

export function undoWeeklyNoOpeningDecision(decisions = {}, facilityId) {
  const key = text(facilityId);
  if (!key || !Object.prototype.hasOwnProperty.call(decisions, key)) return decisions;
  const next = { ...decisions };
  delete next[key];
  return next;
}

export function clearWeeklyNoOpeningDecisions() {
  return {};
}

export function unresolvedOpeningRiskFacilityIds(issues = []) {
  return Array.from(new Set(values(issues).flatMap((issue) => [
    text(issue?.facilityId),
    ...values(issue?.facilityIds).map(text),
  ]).filter(Boolean)));
}

function structuralBlockers(issues = []) {
  return values(issues).filter((issue) => STRUCTURAL_BLOCKER_CODES.has(text(issue?.code)));
}

function autoStandardOutcome({ eligibility, hasTemplate }) {
  if (!hasTemplate) {
    return {
      readiness: "Needs Review",
      outcomeLabel: "Weekly Decision Needed",
      reportRequired: true,
      actionEligible: false,
      reason: "The standard no-openings template is unavailable.",
    };
  }
  if (!eligibility?.canCreateFinalPreview || !eligibility?.canDownloadWorkbook) {
    return {
      readiness: "Blocked",
      outcomeLabel: "Blocked",
      reportRequired: true,
      actionEligible: false,
      reason: "Resolve the reporting blockers before creating a no-openings report.",
    };
  }
  if (!eligibility?.canPrepareEmail || !eligibility?.canMarkReady) {
    return {
      readiness: "Needs Review",
      outcomeLabel: "Weekly Decision Needed",
      reportRequired: true,
      actionEligible: true,
      reason: "The report can be inspected, but recipient information must be corrected before it is Ready.",
    };
  }
  return {
    readiness: "Ready",
    outcomeLabel: "Ready Automatically",
    reportRequired: true,
    actionEligible: true,
    reason: "The standard no-openings report is ready.",
  };
}

export function deriveNoOpeningFacilityOutcome({
  row = {},
  policy = NO_OPENINGS_POLICIES.ASK_WEEKLY,
  weeklyDecision = "",
  eligibility = {},
  hasTemplate = false,
  unresolvedOpeningRisk = false,
} = {}) {
  if (values(row.activeReqs).length) {
    return {
      applies: false,
      readiness: "",
      outcomeLabel: "",
      reportRequired: true,
      actionEligible: true,
      reason: "",
    };
  }

  const structuralIssues = structuralBlockers(eligibility.scopedIssues);
  const structurallyUnsafe = !text(row.facilityId)
    || row.canonicalResolutionComplete === false
    || row.requisitionStatusReliable === false
    || unresolvedOpeningRisk
    || structuralIssues.length > 0;
  if (structurallyUnsafe) {
    return {
      applies: true,
      readiness: "Blocked",
      outcomeLabel: "Blocked",
      reportRequired: true,
      actionEligible: false,
      reason: "No-opening automation is paused until facility and requisition identity is reliable.",
    };
  }

  const effectivePolicy = policy === NO_OPENINGS_POLICIES.ASK_WEEKLY
    && weeklyDecision === NO_OPENINGS_WEEKLY_DECISIONS.CREATE_STANDARD_REPORT
    ? NO_OPENINGS_POLICIES.AUTO_STANDARD_REPORT
    : policy;

  if (
    effectivePolicy === NO_OPENINGS_POLICIES.NO_REPORT_REQUIRED
    || (policy === NO_OPENINGS_POLICIES.ASK_WEEKLY && weeklyDecision === NO_OPENINGS_WEEKLY_DECISIONS.NO_REPORT_NEEDED)
  ) {
    return {
      applies: true,
      readiness: "No Report Required",
      outcomeLabel: "No Report Required",
      reportRequired: false,
      actionEligible: false,
      reason: "No report or sending action is required for this facility.",
    };
  }

  if (effectivePolicy === NO_OPENINGS_POLICIES.AUTO_STANDARD_REPORT) {
    return {
      applies: true,
      ...autoStandardOutcome({ eligibility, hasTemplate }),
    };
  }

  return {
    applies: true,
    readiness: "Needs Review",
    outcomeLabel: "Weekly Decision Needed",
    reportRequired: true,
    actionEligible: false,
    reason: "Choose whether to create a standard report for this session. This choice is not saved across sessions.",
  };
}

export function applyNoOpeningOutcome(row = {}, outcome = {}) {
  if (!outcome.applies) return row;
  return {
    ...row,
    noOpeningOutcome: outcome,
    noOpeningOutcomeLabel: outcome.outcomeLabel,
    reportRequired: outcome.reportRequired,
    reportActionEligible: outcome.actionEligible,
    policyReadiness: outcome.readiness,
    status: outcome.readiness,
    complete: ["Ready", "Scheduled", "Sent"].includes(outcome.readiness),
    action: outcome.readiness === "No Report Required" ? "Audit" : row.action,
  };
}

export function reportActionEligibleRows(rows = []) {
  return values(rows).filter((row) => row.reportRequired !== false && row.reportActionEligible !== false);
}

export function noOpeningReportingSummary(rows = []) {
  const required = values(rows).filter((row) => row.reportRequired !== false);
  const done = required.filter((row) => ["Ready", "Scheduled", "Sent"].includes(row.readiness || row.status)).length;
  const blocked = required.filter((row) => (row.readiness || row.status) === "Blocked").length;
  return {
    total: required.length,
    done,
    remaining: Math.max(0, required.length - done),
    noReportRequired: values(rows).filter((row) => row.reportRequired === false).length,
    ready: required.filter((row) => (row.readiness || row.status) === "Ready").length,
    scheduled: required.filter((row) => (row.readiness || row.status) === "Scheduled").length,
    review: required.filter((row) => (row.readiness || row.status) === "Needs Review").length,
    blocked,
    missing: blocked,
  };
}
