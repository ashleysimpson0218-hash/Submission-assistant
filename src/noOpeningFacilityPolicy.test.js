import {
  NO_OPENINGS_POLICIES,
  NO_OPENINGS_WEEKLY_DECISIONS,
  applyNoOpeningOutcome,
  clearWeeklyNoOpeningDecisions,
  deriveNoOpeningFacilityOutcome,
  deriveNoOpeningsPolicy,
  noOpeningReportingSummary,
  reportActionEligibleRows,
  settingsWithNoOpeningsPolicy,
  undoWeeklyNoOpeningDecision,
  unresolvedOpeningRiskFacilityIds,
  updateWeeklyNoOpeningDecision,
} from "./noOpeningFacilityPolicy";

const template = { subject: "No openings: {facility}", body: "No current openings." };
const settings = (reportAutomation = {}, templates = { noOpeningsWeeklyReport: template }) => ({
  options: { reportAutomation },
  templates,
  general: { workspaceName: "Preserved" },
});
const eligible = {
  canCreateFinalPreview: true,
  canDownloadWorkbook: true,
  canPrepareEmail: true,
  canMarkReady: true,
  scopedIssues: [],
};
const noOpeningRow = {
  id: "facility-1",
  facilityId: "facility-1",
  activeReqs: [],
  canonicalResolutionComplete: true,
  requisitionStatusReliable: true,
};

test.each([
  [{ noOpeningsPolicy: "auto-standard-report" }, NO_OPENINGS_POLICIES.AUTO_STANDARD_REPORT],
  [{ includeNoOpeningFacilities: false }, NO_OPENINGS_POLICIES.NO_REPORT_REQUIRED],
  [{ includeNoOpeningFacilities: true, useNoOpeningsTemplate: true }, NO_OPENINGS_POLICIES.AUTO_STANDARD_REPORT],
  [{ includeNoOpeningFacilities: true, useNoOpeningsTemplate: false }, NO_OPENINGS_POLICIES.ASK_WEEKLY],
  [{}, NO_OPENINGS_POLICIES.ASK_WEEKLY],
])("legacy settings normalize deterministically without mutation: %j", (automation, expected) => {
  const source = settings(automation);
  const before = JSON.stringify(source);
  expect(deriveNoOpeningsPolicy(source)).toBe(expected);
  expect(JSON.stringify(source)).toBe(before);
});

test("explicit policy saving changes only the intended nested field", () => {
  const source = settings({ enabled: true, includeNoOpeningFacilities: false });
  const next = settingsWithNoOpeningsPolicy(source, NO_OPENINGS_POLICIES.AUTO_STANDARD_REPORT);
  expect(next).toEqual({
    ...source,
    options: {
      reportAutomation: {
        enabled: true,
        includeNoOpeningFacilities: false,
        noOpeningsPolicy: NO_OPENINGS_POLICIES.AUTO_STANDARD_REPORT,
      },
    },
  });
  expect(source.options.reportAutomation.noOpeningsPolicy).toBeUndefined();
});

test("auto-standard-report is Ready only when all final and recipient eligibility passes", () => {
  const outcome = deriveNoOpeningFacilityOutcome({
    row: noOpeningRow,
    policy: NO_OPENINGS_POLICIES.AUTO_STANDARD_REPORT,
    eligibility: eligible,
    hasTemplate: true,
  });
  expect(outcome).toMatchObject({ readiness: "Ready", outcomeLabel: "Ready Automatically", reportRequired: true });
});

test("missing contact permits report inspection but prevents automatic Ready", () => {
  const outcome = deriveNoOpeningFacilityOutcome({
    row: noOpeningRow,
    policy: NO_OPENINGS_POLICIES.AUTO_STANDARD_REPORT,
    eligibility: {
      ...eligible,
      canPrepareEmail: false,
      canMarkReady: false,
      scopedIssues: [{ code: "MISSING_REQUIRED_CONTACT", blocking: true, facilityId: "facility-1" }],
    },
    hasTemplate: true,
  });
  expect(outcome).toMatchObject({ readiness: "Blocked", reportRequired: true, actionEligible: true });
});

test("a genuine contact blocker takes precedence over Ask Weekly before and after a weekly decision", () => {
  const contactBlocked = {
    ...eligible,
    canPrepareEmail: false,
    canMarkReady: false,
    scopedIssues: [{
      code: "MISSING_REQUIRED_CONTACT",
      blocking: true,
      facilityId: "facility-1",
    }],
  };

  expect(deriveNoOpeningFacilityOutcome({
    row: noOpeningRow,
    policy: NO_OPENINGS_POLICIES.ASK_WEEKLY,
    eligibility: contactBlocked,
    hasTemplate: true,
  })).toMatchObject({
    readiness: "Blocked",
    outcomeLabel: "Blocked",
    reportRequired: true,
  });
  expect(deriveNoOpeningFacilityOutcome({
    row: noOpeningRow,
    policy: NO_OPENINGS_POLICIES.ASK_WEEKLY,
    weeklyDecision: NO_OPENINGS_WEEKLY_DECISIONS.CREATE_STANDARD_REPORT,
    eligibility: contactBlocked,
    hasTemplate: true,
  }).readiness).toBe("Blocked");
  expect(deriveNoOpeningFacilityOutcome({
    row: noOpeningRow,
    policy: NO_OPENINGS_POLICIES.ASK_WEEKLY,
    weeklyDecision: NO_OPENINGS_WEEKLY_DECISIONS.NO_REPORT_NEEDED,
    eligibility: contactBlocked,
    hasTemplate: true,
  }).readiness).toBe("Blocked");
});

test("resolving a genuine blocker reveals the unresolved Ask Weekly Needs Review state", () => {
  const blocked = deriveNoOpeningFacilityOutcome({
    row: noOpeningRow,
    policy: NO_OPENINGS_POLICIES.ASK_WEEKLY,
    eligibility: {
      ...eligible,
      canPrepareEmail: false,
      canMarkReady: false,
      scopedIssues: [{ code: "MISSING_REQUIRED_CONTACT", blocking: true }],
    },
    hasTemplate: true,
  });
  const resolved = deriveNoOpeningFacilityOutcome({
    row: noOpeningRow,
    policy: NO_OPENINGS_POLICIES.ASK_WEEKLY,
    eligibility: eligible,
    hasTemplate: true,
  });

  expect(blocked.readiness).toBe("Blocked");
  expect(resolved).toMatchObject({ readiness: "Needs Review", outcomeLabel: "Weekly Decision Needed" });
});

test.each([
  [{ facilityId: "", canonicalResolutionComplete: false }, "missing Facility ID"],
  [{ facilityId: "facility-1", canonicalResolutionComplete: false }, "incomplete canonical resolution"],
  [{ facilityId: "facility-1", requisitionStatusReliable: false }, "unknown requisition status"],
])("unsafe no-opening record remains blocked: %s", (patch) => {
  const outcome = deriveNoOpeningFacilityOutcome({
    row: { ...noOpeningRow, ...patch },
    policy: NO_OPENINGS_POLICIES.NO_REPORT_REQUIRED,
    eligibility: eligible,
    hasTemplate: true,
  });
  expect(outcome).toMatchObject({ readiness: "Blocked", reportRequired: true, actionEligible: false });
});

test.each(["AMBIGUOUS_FACILITY", "UNMAPPED_FACILITY", "MISSING_FACILITY_ID", "MISSING_REQUISITION_ID"])(
  "%s prevents no-opening automation from hiding the affected scope",
  (code) => {
    const outcome = deriveNoOpeningFacilityOutcome({
      row: noOpeningRow,
      policy: NO_OPENINGS_POLICIES.NO_REPORT_REQUIRED,
      eligibility: { ...eligible, scopedIssues: [{ code }] },
      hasTemplate: true,
    });
    expect(outcome.readiness).toBe("Blocked");
  },
);

test("an unresolved possible opening blocks only the canonical facility choices it can affect", () => {
  const affectedIds = unresolvedOpeningRiskFacilityIds([
    { issue: "Ambiguous Facility", facilityIds: ["facility-1", "facility-2"] },
    { issue: "Unmapped Facility" },
  ]);

  expect(affectedIds).toEqual(["facility-1", "facility-2"]);
  expect(deriveNoOpeningFacilityOutcome({
    row: noOpeningRow,
    policy: NO_OPENINGS_POLICIES.AUTO_STANDARD_REPORT,
    eligibility: eligible,
    hasTemplate: true,
    unresolvedOpeningRisk: affectedIds.includes(noOpeningRow.facilityId),
  }).readiness).toBe("Blocked");
  expect(deriveNoOpeningFacilityOutcome({
    row: { ...noOpeningRow, facilityId: "facility-3" },
    policy: NO_OPENINGS_POLICIES.ASK_WEEKLY,
    eligibility: eligible,
    hasTemplate: true,
    unresolvedOpeningRisk: affectedIds.includes("facility-3"),
  })).toMatchObject({
    readiness: "Needs Review",
    outcomeLabel: "Weekly Decision Needed",
  });
});

test("no-report-required is explicit and excluded from required report actions and counts", () => {
  const outcome = deriveNoOpeningFacilityOutcome({
    row: noOpeningRow,
    policy: NO_OPENINGS_POLICIES.NO_REPORT_REQUIRED,
    eligibility: eligible,
    hasTemplate: true,
  });
  const excluded = { ...applyNoOpeningOutcome(noOpeningRow, outcome), readiness: outcome.readiness };
  const ready = { id: "facility-2", readiness: "Ready", reportRequired: true };
  expect(excluded).toMatchObject({ status: "No Report Required", complete: false, reportRequired: false });
  expect(reportActionEligibleRows([excluded, ready])).toEqual([ready]);
  expect(noOpeningReportingSummary([excluded, ready])).toEqual({
    total: 1,
    done: 1,
    remaining: 0,
    noReportRequired: 1,
    ready: 1,
    scheduled: 0,
    review: 0,
    blocked: 0,
    missing: 0,
  });
});

test("ask-weekly decisions are session-only values with create, no-report, and undo behavior", () => {
  let decisions = {};
  decisions = updateWeeklyNoOpeningDecision(decisions, "facility-1", NO_OPENINGS_WEEKLY_DECISIONS.CREATE_STANDARD_REPORT);
  expect(deriveNoOpeningFacilityOutcome({
    row: noOpeningRow,
    policy: NO_OPENINGS_POLICIES.ASK_WEEKLY,
    weeklyDecision: decisions["facility-1"],
    eligibility: eligible,
    hasTemplate: true,
  }).readiness).toBe("Ready");

  decisions = updateWeeklyNoOpeningDecision(decisions, "facility-1", NO_OPENINGS_WEEKLY_DECISIONS.NO_REPORT_NEEDED);
  expect(deriveNoOpeningFacilityOutcome({
    row: noOpeningRow,
    policy: NO_OPENINGS_POLICIES.ASK_WEEKLY,
    weeklyDecision: decisions["facility-1"],
    eligibility: eligible,
    hasTemplate: true,
  }).readiness).toBe("No Report Required");

  decisions = undoWeeklyNoOpeningDecision(decisions, "facility-1");
  expect(decisions).toEqual({});
  expect(deriveNoOpeningFacilityOutcome({
    row: noOpeningRow,
    policy: NO_OPENINGS_POLICIES.ASK_WEEKLY,
    eligibility: eligible,
    hasTemplate: true,
  })).toMatchObject({ readiness: "Needs Review", outcomeLabel: "Weekly Decision Needed" });
});

test("ask-weekly Needs Review counts and canonical readiness recalculate after a session decision", () => {
  const pendingOutcome = deriveNoOpeningFacilityOutcome({
    row: noOpeningRow,
    policy: NO_OPENINGS_POLICIES.ASK_WEEKLY,
    eligibility: eligible,
    hasTemplate: true,
  });
  const pendingRow = {
    ...applyNoOpeningOutcome(noOpeningRow, pendingOutcome),
    readiness: pendingOutcome.readiness,
  };
  const decidedOutcome = deriveNoOpeningFacilityOutcome({
    row: noOpeningRow,
    policy: NO_OPENINGS_POLICIES.ASK_WEEKLY,
    weeklyDecision: NO_OPENINGS_WEEKLY_DECISIONS.CREATE_STANDARD_REPORT,
    eligibility: eligible,
    hasTemplate: true,
  });
  const decidedRow = {
    ...applyNoOpeningOutcome(noOpeningRow, decidedOutcome),
    readiness: decidedOutcome.readiness,
  };

  expect(pendingRow).toMatchObject({
    status: "Needs Review",
    readiness: "Needs Review",
    noOpeningOutcomeLabel: "Weekly Decision Needed",
  });
  expect(noOpeningReportingSummary([pendingRow])).toMatchObject({
    review: 1,
    blocked: 0,
    ready: 0,
    remaining: 1,
  });
  expect(decidedRow).toMatchObject({ status: "Ready", readiness: "Ready" });
  expect(noOpeningReportingSummary([decidedRow])).toMatchObject({
    review: 0,
    blocked: 0,
    ready: 1,
    remaining: 0,
  });
});

test("weekly decisions are plain session state and do not create report history", () => {
  const decisions = updateWeeklyNoOpeningDecision({}, "facility-1", NO_OPENINGS_WEEKLY_DECISIONS.NO_REPORT_NEEDED);
  expect(decisions).toEqual({ "facility-1": "no-report-needed" });
  expect(decisions.reportHistory).toBeUndefined();
  expect(undoWeeklyNoOpeningDecision(decisions, "facility-1")).toEqual({});
  expect(clearWeeklyNoOpeningDecisions(decisions)).toEqual({});
});
