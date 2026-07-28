const ACTION_KEYS = [
  "canViewDiagnostics",
  "canViewDraftPreview",
  "canCreateFinalPreview",
  "canGenerateReport",
  "canDownloadWorkbook",
  "canPrepareEmail",
  "canMarkReady",
  "canMarkSent",
];

export const REPORTING_ISSUE_CODES = {
  AMBIGUOUS_FACILITY: "AMBIGUOUS_FACILITY",
  UNMAPPED_FACILITY: "UNMAPPED_FACILITY",
  MISSING_FACILITY_ID: "MISSING_FACILITY_ID",
  MISSING_REQUISITION_ID: "MISSING_REQUISITION_ID",
  AMBIGUOUS_REQUISITION: "AMBIGUOUS_REQUISITION",
  MISSING_REQUIRED_FTE: "MISSING_REQUIRED_FTE",
  MISSING_REQUIRED_SHIFT: "MISSING_REQUIRED_SHIFT",
  MISSING_REQUIRED_CONTACT: "MISSING_REQUIRED_CONTACT",
  WARNING: "WARNING",
};

const FINAL_OUTPUT_BLOCK = {
  canCreateFinalPreview: false,
  canGenerateReport: false,
  canDownloadWorkbook: false,
  canPrepareEmail: false,
  canMarkReady: false,
  canMarkSent: false,
};

const ISSUE_RULES = {
  [REPORTING_ISSUE_CODES.AMBIGUOUS_FACILITY]: FINAL_OUTPUT_BLOCK,
  [REPORTING_ISSUE_CODES.UNMAPPED_FACILITY]: FINAL_OUTPUT_BLOCK,
  [REPORTING_ISSUE_CODES.MISSING_FACILITY_ID]: FINAL_OUTPUT_BLOCK,
  [REPORTING_ISSUE_CODES.MISSING_REQUISITION_ID]: FINAL_OUTPUT_BLOCK,
  [REPORTING_ISSUE_CODES.AMBIGUOUS_REQUISITION]: FINAL_OUTPUT_BLOCK,
  [REPORTING_ISSUE_CODES.MISSING_REQUIRED_FTE]: FINAL_OUTPUT_BLOCK,
  [REPORTING_ISSUE_CODES.MISSING_REQUIRED_SHIFT]: FINAL_OUTPUT_BLOCK,
  [REPORTING_ISSUE_CODES.MISSING_REQUIRED_CONTACT]: {
    canPrepareEmail: false,
    canMarkReady: false,
    canMarkSent: false,
  },
  [REPORTING_ISSUE_CODES.WARNING]: {},
};

const ISSUE_LABEL_TO_CODE = {
  "ambiguous facility": REPORTING_ISSUE_CODES.AMBIGUOUS_FACILITY,
  "unmapped facility": REPORTING_ISSUE_CODES.UNMAPPED_FACILITY,
  "missing facility": REPORTING_ISSUE_CODES.MISSING_FACILITY_ID,
  "missing facility id": REPORTING_ISSUE_CODES.MISSING_FACILITY_ID,
  "missing requisition id": REPORTING_ISSUE_CODES.MISSING_REQUISITION_ID,
  "missing requisition number": REPORTING_ISSUE_CODES.MISSING_REQUISITION_ID,
  "ambiguous requisition": REPORTING_ISSUE_CODES.AMBIGUOUS_REQUISITION,
  "missing fte": REPORTING_ISSUE_CODES.MISSING_REQUIRED_FTE,
  "missing required fte": REPORTING_ISSUE_CODES.MISSING_REQUIRED_FTE,
  "missing shift": REPORTING_ISSUE_CODES.MISSING_REQUIRED_SHIFT,
  "missing required shift": REPORTING_ISSUE_CODES.MISSING_REQUIRED_SHIFT,
  "missing contact": REPORTING_ISSUE_CODES.MISSING_REQUIRED_CONTACT,
  "missing facility contact": REPORTING_ISSUE_CODES.MISSING_REQUIRED_CONTACT,
  "missing required contact": REPORTING_ISSUE_CODES.MISSING_REQUIRED_CONTACT,
};

const asText = (value) => String(value ?? "").trim();
const asArray = (value) => Array.isArray(value) ? value.map(asText).filter(Boolean) : [];

export function reportingIssueCode(issue = {}) {
  const explicit = asText(issue.code);
  if (ISSUE_RULES[explicit]) return explicit;
  return ISSUE_LABEL_TO_CODE[asText(issue.issue || issue.type).toLowerCase()] || REPORTING_ISSUE_CODES.WARNING;
}

export function createReportingIssue(issue = {}) {
  const code = reportingIssueCode(issue);
  return {
    ...issue,
    code,
    issue: asText(issue.issue || issue.type) || "Reporting warning",
    type: asText(issue.type || issue.issue) || "Reporting warning",
    facilityId: asText(issue.facilityId),
    facilityIds: Array.from(new Set([...asArray(issue.facilityIds), asText(issue.facilityId)].filter(Boolean))),
    requisitionId: asText(issue.requisitionId),
    requisitionIds: Array.from(new Set([...asArray(issue.requisitionIds), asText(issue.requisitionId)].filter(Boolean))),
    candidateId: asText(issue.candidateId),
    candidateIds: Array.from(new Set([...asArray(issue.candidateIds), asText(issue.candidateId)].filter(Boolean))),
    facilityName: asText(issue.facilityName),
    originalFacilityLabel: asText(issue.originalFacilityLabel),
    requisitionNumber: asText(issue.requisitionNumber),
    position: asText(issue.position),
    candidateName: asText(issue.candidateName),
    canonicalFacilityName: asText(issue.canonicalFacilityName || issue.facilityName),
    regionId: asText(issue.regionId),
    regionName: asText(issue.regionName),
    currentFte: asText(issue.currentFte),
    currentShift: asText(issue.currentShift),
    currentContact: asText(issue.currentContact),
    currentContactStatus: asText(issue.currentContactStatus),
    audienceContext: asText(issue.audienceContext || issue.audience),
    recipientGroup: asText(issue.recipientGroup),
    missingContactRole: asText(issue.missingContactRole),
    affectedReportScope: asText(issue.affectedReportScope),
    sourceValue: asText(issue.sourceValue || issue.originalFacilityLabel),
    reason: asText(issue.reason || issue.detail),
    competingFacilityNames: asArray(issue.competingFacilityNames),
    competingFacilityIds: asArray(issue.competingFacilityIds || issue.facilityIds),
    missingField: asText(issue.missingField),
    resolutionAction: asText(issue.resolutionAction),
    blocking: Object.values(ISSUE_RULES[code]).some((value) => value === false),
  };
}

export function createMissingContactReportingIssue(row = {}) {
  const activeReqs = Array.isArray(row.activeReqs) ? row.activeReqs : [];
  const firstReq = activeReqs[0] || {};
  const facilityName = asText(row.facilityName || row.facility);
  const reportType = asText(row.reportType || row.report) || "Facility report";
  const recipientGroup = asText(row.recipientGroup) || "Facility Contacts";
  return createReportingIssue({
    code: REPORTING_ISSUE_CODES.MISSING_REQUIRED_CONTACT,
    issue: "Missing facility contact",
    type: "Missing facility contact",
    recordType: activeReqs.length ? "Requisition" : "Facility",
    identifier: asText(firstReq.id || firstReq.requisitionId || row.facilityId || row.id),
    facilityId: asText(row.facilityId || row.id),
    facilityName,
    canonicalFacilityName: facilityName,
    originalFacilityLabel: asText(row.originalFacilityLabel || facilityName),
    regionId: asText(row.regionId),
    regionName: asText(row.regionName),
    requisitionId: asText(firstReq.id || firstReq.requisitionId),
    requisitionIds: activeReqs.map((requisition) => requisition?.id || requisition?.requisitionId),
    requisitionNumber: asText(firstReq.requisitionNumber || firstReq.reqNumber),
    position: asText(firstReq.position || firstReq.positionTitle),
    audienceContext: "Facility",
    recipientGroup,
    missingContactRole: recipientGroup,
    affectedReportScope: `${reportType} for ${facilityName || asText(row.facilityId || row.id)}`,
    currentContactStatus: "No active facility contact configured",
    missingField: "Facility recipient",
    sourceValue: asText(row.originalFacilityLabel || facilityName),
    reason: "A facility contact is required before email preparation or Ready status.",
    resolutionAction: "Add Contact",
    source: "Facility report queue",
  });
}

export function reportingIssueContextRows(issue = {}) {
  const normalized = createReportingIssue(issue);
  const isFteIssue = normalized.code === REPORTING_ISSUE_CODES.MISSING_REQUIRED_FTE;
  const isShiftIssue = normalized.code === REPORTING_ISSUE_CODES.MISSING_REQUIRED_SHIFT;
  const isContactIssue = normalized.code === REPORTING_ISSUE_CODES.MISSING_REQUIRED_CONTACT;
  const rows = [
    ["Candidate name", normalized.candidateName],
    ["Candidate ID", normalized.candidateId],
    ["Requisition title", normalized.position],
    ["Requisition number", normalized.requisitionNumber],
    ["Requisition ID", normalized.requisitionId],
    ["Facility as entered", normalized.originalFacilityLabel],
    ["Canonical facility", normalized.canonicalFacilityName],
    ["Facility ID", normalized.facilityId],
    ["Region", normalized.regionName],
    ["Audience", normalized.audienceContext],
    ["Recipient group", normalized.recipientGroup],
    ["Missing contact role", normalized.missingContactRole],
    ["Affected report scope", normalized.affectedReportScope],
    ["Current FTE value", isFteIssue ? normalized.currentFte || "Not set" : normalized.currentFte],
    ["Current shift value", isShiftIssue ? normalized.currentShift || "Not set" : normalized.currentShift],
    ["Current contact", normalized.currentContact],
    ["Contact status", isContactIssue ? normalized.currentContactStatus || "Not configured" : normalized.currentContactStatus],
    ["Alias or unresolved source value", normalized.sourceValue],
    ["Canonical facility choices", normalized.competingFacilityNames.join(", ")],
    ["Canonical facility IDs", normalized.competingFacilityIds.join(", ")],
    ["Blocking reason", normalized.reason || normalized.issue],
  ];
  const seen = new Set();
  return rows.filter(([label, value]) => {
    const displayValue = asText(value);
    const key = `${label}|${displayValue}`;
    if (!displayValue || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(([label, value]) => ({ label, value: asText(value) }));
}

function intersects(left = [], right = []) {
  const allowed = new Set(asArray(right));
  return asArray(left).some((value) => allowed.has(value));
}

export function reportingIssueAffectsScope(issue = {}, scope = {}) {
  if (scope.all === true) return true;
  const normalized = createReportingIssue(issue);
  const facilityIds = asArray(scope.facilityIds);
  const requisitionIds = asArray(scope.requisitionIds);
  const candidateIds = asArray(scope.candidateIds);
  const hasExplicitScope = facilityIds.length || requisitionIds.length || candidateIds.length;
  if (!hasExplicitScope) return true;
  if (intersects(normalized.facilityIds, facilityIds)) return true;
  if (intersects(normalized.requisitionIds, requisitionIds)) return true;
  if (intersects(normalized.candidateIds, candidateIds)) return true;
  return false;
}

export function reportingActionEligibility(issues = [], scope = {}) {
  const scopedIssues = issues.map(createReportingIssue).filter((issue) => reportingIssueAffectsScope(issue, scope));
  const result = Object.fromEntries(ACTION_KEYS.map((key) => [key, true]));
  const reasonsByAction = Object.fromEntries(ACTION_KEYS.map((key) => [key, []]));

  scopedIssues.forEach((issue) => {
    const rule = ISSUE_RULES[issue.code] || {};
    Object.entries(rule).forEach(([action, allowed]) => {
      if (allowed !== false) return;
      result[action] = false;
      reasonsByAction[action].push(issue);
    });
  });

  return {
    ...result,
    scopedIssues,
    blockingReasons: scopedIssues.filter((issue) => issue.blocking),
    reasonsByAction,
  };
}

const READY_STATUSES = new Set(["Ready", "Ready to Send"]);
const NON_ACTIONABLE_READINESS = new Set(["Blocked", "No Report Required", "Scheduled", "Sent"]);

function reportRowId(row = {}) {
  return asText(row.id || row.facilityId);
}

function reportingScopeForRow(row = {}) {
  return {
    facilityIds: [asText(row.facilityId || row.id)].filter(Boolean),
    requisitionIds: (Array.isArray(row.activeReqs) ? row.activeReqs : [])
      .map((requisition) => asText(requisition?.id || requisition?.requisitionId))
      .filter(Boolean),
    candidateIds: (Array.isArray(row.candidates) ? row.candidates : [])
      .map((candidate) => asText(candidate?.id || candidate?.candidateId))
      .filter(Boolean),
  };
}

function rowTransitionState(row = {}, issues = []) {
  const eligibility = reportingActionEligibility(issues, reportingScopeForRow(row));
  const status = asText(row.status);
  const readiness = asText(row.readiness);
  const effectiveReadiness = readiness || status;
  const policyEligible = row.reportRequired !== false && row.reportActionEligible !== false;
  const blocked = effectiveReadiness === "Blocked" || status === "Blocked";
  const actionSuppressed = NON_ACTIONABLE_READINESS.has(effectiveReadiness);
  const ready = policyEligible
    && READY_STATUSES.has(effectiveReadiness)
    && !["Reviewed", "Sent"].includes(status)
    && eligibility.canMarkReady
    && eligibility.canPrepareEmail;
  const markReviewed = ready;
  const markSent = policyEligible
    && status === "Reviewed"
    && eligibility.canPrepareEmail
    && eligibility.canMarkSent;

  return {
    eligibility,
    previewable: policyEligible && eligibility.canViewDraftPreview,
    downloadable: policyEligible && !blocked && !actionSuppressed && eligibility.canDownloadWorkbook,
    emailAvailable: policyEligible && !blocked && !actionSuppressed && eligibility.canPrepareEmail,
    ready,
    markReviewed,
    markSent,
  };
}

export function deriveReportingActionState({
  rows = [],
  selectedReportIds = [],
  issues = [],
} = {}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const selectedIds = Array.from(new Set(asArray(selectedReportIds)));
  const selected = new Set(selectedIds);
  const states = safeRows.map((row) => ({
    id: reportRowId(row),
    row,
    ...rowTransitionState(row, issues),
  })).filter((entry) => entry.id);
  const selectedStates = states.filter((entry) => selected.has(entry.id));
  const idsFor = (entries, predicate) => entries.filter(predicate).map((entry) => entry.id);

  const totalReadyReportIds = idsFor(states, (entry) => entry.ready);
  const totalMarkReviewedReportIds = idsFor(states, (entry) => entry.markReviewed);
  const totalMarkSentReportIds = idsFor(states, (entry) => entry.markSent);
  const selectedPreviewableReportIds = idsFor(selectedStates, (entry) => entry.previewable);
  const selectedDownloadableReportIds = idsFor(selectedStates, (entry) => entry.downloadable);
  const selectedEmailReportIds = idsFor(selectedStates, (entry) => entry.emailAvailable);
  const selectedReadyReportIds = idsFor(selectedStates, (entry) => entry.ready);
  const selectedMarkReviewedReportIds = idsFor(selectedStates, (entry) => entry.markReviewed);
  const selectedMarkSentReportIds = idsFor(selectedStates, (entry) => entry.markSent);

  return {
    scopeFacilityIds: selectedStates.map((entry) => asText(entry.row.facilityId || entry.row.id)).filter(Boolean),
    totalReadyReportIds,
    totalMarkReviewedReportIds,
    totalMarkSentReportIds,
    selectedReportIds: selectedIds,
    selectedPreviewableReportIds,
    selectedDownloadableReportIds,
    selectedEmailReportIds,
    selectedReadyReportIds,
    selectedMarkReviewedReportIds,
    selectedMarkSentReportIds,
    selectedCount: selectedIds.length,
    blockerCount: selectedStates.filter((entry) => (
      entry.row.readiness === "Blocked"
      || entry.row.status === "Blocked"
      || entry.eligibility.blockingReasons.length > 0
    )).length,
  };
}

export function groupReportingIssues(issues = [], scope = {}) {
  const groups = new Map();
  issues
    .map(createReportingIssue)
    .filter((issue) => reportingIssueAffectsScope(issue, scope))
    .forEach((issue) => {
      const current = groups.get(issue.code) || {
        code: issue.code,
        label: issue.issue,
        blocking: issue.blocking,
        count: 0,
        issues: [],
      };
      current.count += 1;
      current.blocking = current.blocking || issue.blocking;
      current.issues.push(issue);
      groups.set(issue.code, current);
    });
  return Array.from(groups.values()).sort((a, b) => {
    if (a.blocking !== b.blocking) return a.blocking ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
}

export const REPORT_ACTION_EFFECTS = {
  reviewReport: "none",
  copyEmailBody: "none",
  downloadCombinedWorkbook: "download-only",
  downloadSeparateFacilityWorkbooks: "download-only",
  saveDraftToHistory: "Draft",
  markReviewed: "Reviewed",
  markReady: "Ready",
  markSent: "Sent",
};

export function explicitReportStatusForAction(action) {
  const effect = REPORT_ACTION_EFFECTS[action];
  return effect && !["none", "download-only"].includes(effect) ? effect : null;
}

export const LEGACY_REPORT_STATUS_DISPLAY = {
  Copied: "Legacy activity: Copied",
  Exported: "Legacy activity: Downloaded",
  "Manually Completed": "Legacy status: Completed",
  Ready: "Ready",
  Sent: "Sent",
};

export function reportStatusCountsAsComplete(status) {
  return ["Sent", "Scheduled", "Manually Completed"].includes(asText(status));
}
