import {
  LEGACY_REPORT_STATUS_DISPLAY,
  REPORTING_ISSUE_CODES,
  createMissingContactReportingIssue,
  deriveReportingActionState,
  explicitReportStatusForAction,
  groupReportingIssues,
  reportingIssueContextRows,
  reportingActionEligibility,
  reportStatusCountsAsComplete,
} from "./weeklyReportingEligibility";

const facilityScope = { facilityIds: ["facility-1"], requisitionIds: ["req-1"], candidateIds: ["candidate-1"] };

test.each([
  REPORTING_ISSUE_CODES.AMBIGUOUS_FACILITY,
  REPORTING_ISSUE_CODES.UNMAPPED_FACILITY,
  REPORTING_ISSUE_CODES.MISSING_FACILITY_ID,
  REPORTING_ISSUE_CODES.MISSING_REQUISITION_ID,
  REPORTING_ISSUE_CODES.MISSING_REQUIRED_FTE,
  REPORTING_ISSUE_CODES.MISSING_REQUIRED_SHIFT,
])("%s permits diagnostics and draft inspection but blocks every final output", (code) => {
  const result = reportingActionEligibility([{ code, issue: code, facilityId: "facility-1" }], facilityScope);

  expect(result).toMatchObject({
    canViewDiagnostics: true,
    canViewDraftPreview: true,
    canCreateFinalPreview: false,
    canGenerateReport: false,
    canDownloadWorkbook: false,
    canPrepareEmail: false,
    canMarkReady: false,
  });
});

test("a missing contact permits report inspection and workbook download but blocks email and Ready", () => {
  const result = reportingActionEligibility([
    { code: REPORTING_ISSUE_CODES.MISSING_REQUIRED_CONTACT, issue: "Missing facility contact", facilityId: "facility-1" },
  ], facilityScope);

  expect(result).toMatchObject({
    canViewDiagnostics: true,
    canViewDraftPreview: true,
    canCreateFinalPreview: true,
    canGenerateReport: true,
    canDownloadWorkbook: true,
    canPrepareEmail: false,
    canMarkReady: false,
    canMarkSent: false,
  });
});

test("a queue-level missing contact becomes one detailed canonical correction issue", () => {
  const row = {
    id: "facility-32",
    facilityId: "facility-32",
    facility: "Synthetic Facility 32",
    originalFacilityLabel: "Synthetic Facility Thirty Two",
    regionId: "south",
    regionName: "South",
    reportType: "No Openings Update",
    recipientGroup: "Facility Contacts",
    missingContact: true,
    activeReqs: [],
  };
  const issue = createMissingContactReportingIssue(row);
  const context = Object.fromEntries(reportingIssueContextRows(issue).map(({ label, value }) => [label, value]));

  expect(issue).toMatchObject({
    code: REPORTING_ISSUE_CODES.MISSING_REQUIRED_CONTACT,
    facilityId: "facility-32",
    resolutionAction: "Add Contact",
    blocking: true,
  });
  expect(context).toMatchObject({
    "Facility as entered": "Synthetic Facility Thirty Two",
    "Canonical facility": "Synthetic Facility 32",
    "Facility ID": "facility-32",
    Region: "South",
    Audience: "Facility",
    "Recipient group": "Facility Contacts",
    "Missing contact role": "Facility Contacts",
    "Affected report scope": "No Openings Update for Synthetic Facility 32",
    "Contact status": "No active facility contact configured",
    "Blocking reason": "A facility contact is required before email preparation or Ready status.",
  });
  expect(row).toEqual(expect.objectContaining({ missingContact: true, activeReqs: [] }));
});

test("issues outside the selected scope do not block its final outputs", () => {
  const result = reportingActionEligibility([
    { code: REPORTING_ISSUE_CODES.AMBIGUOUS_FACILITY, issue: "Ambiguous Facility", facilityId: "facility-2" },
  ], facilityScope);

  expect(result.canCreateFinalPreview).toBe(true);
  expect(result.canDownloadWorkbook).toBe(true);
  expect(result.blockingReasons).toHaveLength(0);
});

test("facility-master ambiguity affects a scope containing either matching facility ID", () => {
  const issue = {
    code: REPORTING_ISSUE_CODES.AMBIGUOUS_FACILITY,
    issue: "Ambiguous Facility",
    facilityIds: ["facility-1", "facility-2"],
  };

  expect(reportingActionEligibility([issue], { facilityIds: ["facility-2"] }).canDownloadWorkbook).toBe(false);
  expect(reportingActionEligibility([issue], { facilityIds: ["facility-3"] }).canDownloadWorkbook).toBe(true);
});

test("grouped issues preserve every missing-shift record without rendering one flat truncated list", () => {
  const issues = [
    ...Array.from({ length: 9 }, (_, index) => ({
      code: REPORTING_ISSUE_CODES.AMBIGUOUS_FACILITY,
      issue: "Ambiguous Facility",
      candidateId: `candidate-${index}`,
    })),
    ...Array.from({ length: 4 }, (_, index) => ({
      code: REPORTING_ISSUE_CODES.MISSING_REQUIRED_SHIFT,
      issue: "Missing shift",
      requisitionId: `shift-req-${index}`,
    })),
  ];
  const groups = groupReportingIssues(issues, { all: true });
  const shiftGroup = groups.find((group) => group.code === REPORTING_ISSUE_CODES.MISSING_REQUIRED_SHIFT);

  expect(groups).toHaveLength(2);
  expect(shiftGroup.count).toBe(4);
  expect(shiftGroup.issues.map((issue) => issue.requisitionId)).toEqual([
    "shift-req-0",
    "shift-req-1",
    "shift-req-2",
    "shift-req-3",
  ]);
});

test("blocker context exposes exact affected source details without changing eligibility", () => {
  const rows = reportingIssueContextRows({
    code: REPORTING_ISSUE_CODES.MISSING_REQUIRED_FTE,
    issue: "Missing FTE",
    candidateName: "Synthetic Candidate 001",
    candidateId: "candidate-1",
    position: "Registered Nurse",
    requisitionNumber: "SYN-1001",
    requisitionId: "req-1",
    originalFacilityLabel: "Synthetic North CTC",
    canonicalFacilityName: "Synthetic Facility 01",
    facilityId: "synthetic-facility-001",
    regionName: "Region Alpha",
    currentFte: "",
    sourceValue: "Synthetic North CTC",
    reason: "Required FTE is missing from this active requisition.",
  });

  expect(Object.fromEntries(rows.map(({ label, value }) => [label, value]))).toMatchObject({
    "Candidate name": "Synthetic Candidate 001",
    "Candidate ID": "candidate-1",
    "Requisition title": "Registered Nurse",
    "Requisition number": "SYN-1001",
    "Requisition ID": "req-1",
    "Facility as entered": "Synthetic North CTC",
    "Canonical facility": "Synthetic Facility 01",
    "Facility ID": "synthetic-facility-001",
    Region: "Region Alpha",
    "Current FTE value": "Not set",
    "Blocking reason": "Required FTE is missing from this active requisition.",
  });
  expect(reportingActionEligibility([{
    code: REPORTING_ISSUE_CODES.MISSING_REQUIRED_FTE,
    facilityId: "synthetic-facility-001",
  }], { facilityIds: ["synthetic-facility-001"] }).canCreateFinalPreview).toBe(false);
});

test("preview, copy, and download actions have no implicit status mutation", () => {
  expect(explicitReportStatusForAction("reviewReport")).toBeNull();
  expect(explicitReportStatusForAction("copyEmailBody")).toBeNull();
  expect(explicitReportStatusForAction("downloadCombinedWorkbook")).toBeNull();
  expect(explicitReportStatusForAction("downloadSeparateFacilityWorkbooks")).toBeNull();
  expect(explicitReportStatusForAction("saveDraftToHistory")).toBe("Draft");
  expect(explicitReportStatusForAction("markReviewed")).toBe("Reviewed");
  expect(explicitReportStatusForAction("markReady")).toBe("Ready");
  expect(explicitReportStatusForAction("markSent")).toBe("Sent");
});

test("legacy statuses remain descriptive rather than being reinterpreted", () => {
  expect(LEGACY_REPORT_STATUS_DISPLAY).toEqual({
    Copied: "Legacy activity: Copied",
    Exported: "Legacy activity: Downloaded",
    "Manually Completed": "Legacy status: Completed",
    Ready: "Ready",
    Sent: "Sent",
  });
  expect(reportStatusCountsAsComplete("Copied")).toBe(false);
  expect(reportStatusCountsAsComplete("Exported")).toBe(false);
  expect(reportStatusCountsAsComplete("Manually Completed")).toBe(true);
  expect(reportStatusCountsAsComplete("Sent")).toBe(true);
});

const actionRows = [
  { id: "ready", facilityId: "ready", readiness: "Ready", status: "Ready", activeReqs: [], candidates: [] },
  { id: "blocked", facilityId: "blocked", readiness: "Blocked", status: "Blocked", activeReqs: [], candidates: [] },
  { id: "needs-review", facilityId: "needs-review", readiness: "Needs Review", status: "Needs Review", activeReqs: [], candidates: [] },
  { id: "not-started", facilityId: "not-started", readiness: "Not Started", status: "Not Started", activeReqs: [], candidates: [] },
  { id: "no-report", facilityId: "no-report", readiness: "No Report Required", status: "No Report Required", reportRequired: false, activeReqs: [], candidates: [] },
  { id: "reviewed", facilityId: "reviewed", readiness: "Ready", status: "Reviewed", activeReqs: [], candidates: [] },
];

test("canonical action state keeps selected, previewable, Ready, reviewable, and sendable reports distinct", () => {
  const state = deriveReportingActionState({
    rows: actionRows,
    selectedReportIds: actionRows.map((row) => row.id),
    issues: [{ code: REPORTING_ISSUE_CODES.AMBIGUOUS_FACILITY, facilityId: "blocked" }],
  });

  expect(state.selectedReportIds).toEqual(["ready", "blocked", "needs-review", "not-started", "no-report", "reviewed"]);
  expect(state.selectedPreviewableReportIds).toEqual(["ready", "blocked", "needs-review", "not-started", "reviewed"]);
  expect(state.totalReadyReportIds).toEqual(["ready"]);
  expect(state.selectedReadyReportIds).toEqual(["ready"]);
  expect(state.selectedDownloadableReportIds).toEqual(["ready", "needs-review", "not-started", "reviewed"]);
  expect(state.selectedMarkReviewedReportIds).toEqual(["ready"]);
  expect(state.selectedMarkSentReportIds).toEqual(["reviewed"]);
  expect(state.blockerCount).toBe(1);
});

test.each(["Blocked", "Needs Review", "Not Started", "No Report Required"])("%s never counts as Ready", (status) => {
  const row = {
    id: status,
    facilityId: status,
    status,
    readiness: status,
    reportRequired: status !== "No Report Required",
  };
  const state = deriveReportingActionState({ rows: [row], selectedReportIds: [status] });
  expect(state.totalReadyReportIds).toEqual([]);
  expect(state.selectedMarkReviewedReportIds).toEqual([]);
});

test("hidden and mixed selections use the same transition eligibility", () => {
  const state = deriveReportingActionState({
    rows: actionRows,
    selectedReportIds: ["ready", "blocked", "not-started"],
    issues: [{ code: REPORTING_ISSUE_CODES.MISSING_REQUIRED_SHIFT, facilityId: "blocked" }],
  });

  expect(state.selectedCount).toBe(3);
  expect(state.selectedPreviewableReportIds).toEqual(["ready", "blocked", "not-started"]);
  expect(state.selectedReadyReportIds).toEqual(["ready"]);
  expect(state.selectedMarkReviewedReportIds).toEqual(["ready"]);
  expect(state.selectedMarkSentReportIds).toEqual([]);
});

test("missing contact keeps workbook inspection available but removes Ready and sent transitions", () => {
  const state = deriveReportingActionState({
    rows: [actionRows[0], actionRows[5]],
    selectedReportIds: ["ready", "reviewed"],
    issues: [
      { code: REPORTING_ISSUE_CODES.MISSING_REQUIRED_CONTACT, facilityId: "ready" },
      { code: REPORTING_ISSUE_CODES.MISSING_REQUIRED_CONTACT, facilityId: "reviewed" },
    ],
  });

  expect(state.selectedDownloadableReportIds).toEqual(["ready", "reviewed"]);
  expect(state.totalReadyReportIds).toEqual([]);
  expect(state.selectedMarkReviewedReportIds).toEqual([]);
  expect(state.selectedMarkSentReportIds).toEqual([]);
});

test("a contact-blocked readiness row remains diagnostically previewable and downloadable", () => {
  const blockedForContact = {
    id: "contact-blocked",
    facilityId: "contact-blocked",
    readiness: "Blocked",
    status: "Blocked",
    reportRequired: true,
    reportActionEligible: true,
    activeReqs: [],
    candidates: [],
  };
  const state = deriveReportingActionState({
    rows: [blockedForContact],
    selectedReportIds: [blockedForContact.id],
    issues: [{
      code: REPORTING_ISSUE_CODES.MISSING_REQUIRED_CONTACT,
      facilityId: blockedForContact.facilityId,
    }],
  });

  expect(state.selectedPreviewableReportIds).toEqual(["contact-blocked"]);
  expect(state.selectedDownloadableReportIds).toEqual(["contact-blocked"]);
  expect(state.selectedEmailReportIds).toEqual([]);
  expect(state.selectedReadyReportIds).toEqual([]);
  expect(state.selectedMarkReviewedReportIds).toEqual([]);
  expect(state.selectedMarkSentReportIds).toEqual([]);
});
