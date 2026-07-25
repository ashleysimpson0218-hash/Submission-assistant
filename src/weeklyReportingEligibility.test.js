import {
  LEGACY_REPORT_STATUS_DISPLAY,
  REPORTING_ISSUE_CODES,
  explicitReportStatusForAction,
  groupReportingIssues,
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
  });
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
