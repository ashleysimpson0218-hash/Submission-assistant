import {
  createWeeklyReviewSessionReset,
  LEGACY_WEEKLY_REPORTING_STEP_MAP,
  RESTART_WEEKLY_REVIEW_CONFIRMATION,
  WEEKLY_REPORTING_STEPS,
  confirmWeeklyReviewRestart,
  normalizeWeeklyReportingStep,
  resolveReportingNavigation,
  selectWeeklyReportingPrimaryAction,
  summarizeWeeklyReportingRows,
  weeklyReportingScopeText,
  weeklyReportingStepNumber,
} from "./weeklyReportingWorkflow";

test("defines exactly five Weekly Reporting steps in the approved order", () => {
  expect(WEEKLY_REPORTING_STEPS.map(({ key, label }) => [key, label])).toEqual([
    ["overview", "Overview"],
    ["candidate-cleanup", "Candidate & ATS Cleanup"],
    ["facility-readiness", "Facility Readiness"],
    ["review-reports", "Review Reports"],
    ["send-export", "Send & Export"],
  ]);
  expect(normalizeWeeklyReportingStep()).toBe("overview");
});

test.each(Object.entries(LEGACY_WEEKLY_REPORTING_STEP_MAP))(
  "maps legacy reporting tab %s to %s",
  (legacy, expected) => {
    expect(normalizeWeeklyReportingStep(legacy)).toBe(expected);
  },
);

test("keeps current step keys, defaults unknown values, and separates Reports & History", () => {
  WEEKLY_REPORTING_STEPS.forEach((step, index) => {
    expect(normalizeWeeklyReportingStep(step.key)).toBe(step.key);
    expect(weeklyReportingStepNumber(step.key)).toBe(index + 1);
  });
  expect(normalizeWeeklyReportingStep("unknown")).toBe("overview");
  expect(resolveReportingNavigation("hub")).toEqual({ destination: "reporting", step: "overview" });
  expect(resolveReportingNavigation("exports")).toEqual({ destination: "reports", step: "send-export" });
});

test("returns the exact approved scope explanation for each step", () => {
  expect(WEEKLY_REPORTING_STEPS.map((step) => weeklyReportingScopeText(step.key))).toEqual([
    "Activity recorded during the selected reporting period.",
    "Candidates in the selected reporting period whose ATS or recruiting status requires review.",
    "Canonical facilities with report-period activity or a required weekly reporting decision.",
    "Reports within the facilities, audiences, and report types currently selected.",
    "Only selected reports currently eligible for the chosen download or sending action.",
  ]);
});

test("context-aware action precedence is deterministic", () => {
  expect(selectWeeklyReportingPrimaryAction({
    blockerCount: 2,
    candidateCleanupCount: 8,
    readyReportCount: 15,
    reviewedReportCount: 4,
  })).toMatchObject({ label: "Continue: Fix 2 Blockers", targetStep: "facility-readiness", count: 2 });
  expect(selectWeeklyReportingPrimaryAction({
    candidateCleanupCount: 8,
    readyReportCount: 15,
    reviewedReportCount: 4,
  })).toMatchObject({ label: "Review 8 Candidate Updates", targetStep: "candidate-cleanup", count: 8 });
  expect(selectWeeklyReportingPrimaryAction({
    readyReportCount: 15,
    reviewedReportCount: 4,
  })).toMatchObject({ label: "Review 15 Ready Reports", targetStep: "review-reports", count: 15 });
  expect(selectWeeklyReportingPrimaryAction({
    reviewedReportCount: 4,
  })).toMatchObject({ label: "Send or Export 4 Reports", targetStep: "send-export", count: 4 });
  expect(selectWeeklyReportingPrimaryAction()).toMatchObject({ label: "View Weekly Summary", targetStep: "overview", count: 0 });
});

test("ready and reviewed report counts remain distinct for the primary action", () => {
  expect(summarizeWeeklyReportingRows([
    { status: "Ready", readiness: "Ready" },
    { status: "Reviewed", readiness: "Ready" },
    { status: "Sent", readiness: "Sent" },
    { status: "Needs Review", readiness: "Ready" },
  ])).toEqual({ ready: 1, reviewed: 1 });
  expect(summarizeWeeklyReportingRows([{ status: "Reviewed", readiness: "Ready" }])).toEqual({ ready: 0, reviewed: 1 });
});

test("restart requires confirmation and invokes only the supplied session reset", () => {
  const restart = jest.fn();
  const decline = jest.fn(() => false);
  expect(confirmWeeklyReviewRestart(decline, restart)).toBe(false);
  expect(decline).toHaveBeenCalledWith(RESTART_WEEKLY_REVIEW_CONFIRMATION);
  expect(restart).not.toHaveBeenCalled();

  const approve = jest.fn(() => true);
  expect(confirmWeeklyReviewRestart(approve, restart)).toBe(true);
  expect(restart).toHaveBeenCalledTimes(1);
});

test("restart state contains only documented report-session fields", () => {
  const reset = createWeeklyReviewSessionReset();
  expect(reset).toEqual({
    completedFacilityReports: {},
    noOpeningWeeklyDecisions: {},
    selectedFacilityReports: [],
    excludedReportIds: [],
    generatedReportPreview: "",
    weeklyReport: "",
    weeklySubject: "Weekly Active Candidate Report",
    activeReportSection: "submitted",
    reportsTab: "overview",
  });
  expect(reset).not.toHaveProperty("tracker");
  expect(reset).not.toHaveProperty("settings");
  expect(reset).not.toHaveProperty("history");
  expect(reset).not.toHaveProperty("contacts");
  expect(reset).not.toHaveProperty("requisitions");
});
