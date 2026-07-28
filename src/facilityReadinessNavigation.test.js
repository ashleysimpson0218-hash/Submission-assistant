import {
  DEFAULT_FACILITY_READINESS_FILTERS,
  buildReportingCorrectionRoute,
  clearFacilitySelection,
  facilityBulkActionLabel,
  facilityReadinessCounts,
  facilitySelectionSummary,
  filterFacilityReadinessRows,
  selectFacilityIds,
  withFacilityReadiness,
} from "./facilityReadinessNavigation";

const rows = [
  withFacilityReadiness({
    id: "facility-burruss",
    facilityId: "facility-burruss",
    facility: "Burruss Correctional Training Center",
    originalFacilityLabel: "Burruss CTC",
    aliases: ["Burruss Training Center"],
    regionId: "central",
    reportType: "Facility Weekly Report",
    status: "Not Started",
  }, [{ blocking: true, issue: "Missing shift" }]),
  withFacilityReadiness({
    id: "facility-central",
    facilityId: "facility-central",
    facility: "Synthetic Central Facility",
    aliases: [],
    regionId: "central",
    reportType: "Facility Weekly Report",
    status: "Needs Review",
  }),
  withFacilityReadiness({
    id: "facility-south",
    facilityId: "facility-south",
    facility: "Synthetic South Facility",
    aliases: [],
    regionId: "south",
    reportType: "No Openings Update",
    status: "Sent",
  }),
  withFacilityReadiness({
    id: "facility-ready",
    facilityId: "facility-ready",
    facility: "Synthetic Ready Facility",
    aliases: [],
    regionId: "central",
    reportType: "Facility Weekly Report",
    status: "Ready",
  }),
  withFacilityReadiness({
    id: "facility-no-report",
    facilityId: "facility-no-report",
    facility: "Synthetic No Report Facility",
    aliases: [],
    regionId: "south",
    reportType: "No Openings Update",
    status: "No Report Required",
    policyReadiness: "No Report Required",
    reportRequired: false,
  }),
];

test("defaults Facility Readiness to Needs Action and includes only Blocked and Needs Review", () => {
  expect(DEFAULT_FACILITY_READINESS_FILTERS.readiness).toBe("Needs Action");
  expect(filterFacilityReadinessRows(rows).map((row) => row.readiness)).toEqual(["Blocked", "Needs Review"]);
});

test.each([
  ["Burruss Correctional", "facility-burruss"],
  ["Burruss CTC", "facility-burruss"],
  ["Burruss Training Center", "facility-burruss"],
  ["facility-burruss", "facility-burruss"],
])("search %s matches canonical names, original labels, aliases, or Facility IDs", (search, expected) => {
  const result = filterFacilityReadinessRows(rows, { ...DEFAULT_FACILITY_READINESS_FILTERS, search, readiness: "All" });
  expect(result.map((row) => row.id)).toEqual([expected]);
});

test("region, readiness, report type, and search combine with AND behavior", () => {
  const result = filterFacilityReadinessRows(rows, {
    search: "Burruss",
    regionId: "central",
    readiness: "Blocked",
    reportType: "Facility Weekly Report",
  });
  expect(result.map((row) => row.id)).toEqual(["facility-burruss"]);
  expect(filterFacilityReadinessRows(rows, {
    search: "Burruss",
    regionId: "south",
    readiness: "Blocked",
    reportType: "Facility Weekly Report",
  })).toEqual([]);
});

test("status counts retain the current search, region, and report-type scope while ignoring readiness", () => {
  const counts = facilityReadinessCounts(rows, {
    search: "Synthetic",
    regionId: "central",
    readiness: "Blocked",
    reportType: "Facility Weekly Report",
  });
  expect(counts).toMatchObject({ All: 2, "Needs Action": 1, Blocked: 0, "Needs Review": 1, Ready: 1 });
});

test("No Report Required remains visible only in its explicit audit filter and not Needs Action", () => {
  expect(filterFacilityReadinessRows(rows, {
    ...DEFAULT_FACILITY_READINESS_FILTERS,
    readiness: "No Report Required",
  }).map((row) => row.id)).toEqual(["facility-no-report"]);
  expect(filterFacilityReadinessRows(rows).map((row) => row.id)).not.toContain("facility-no-report");
  expect(facilityReadinessCounts(rows)["No Report Required"]).toBe(1);
});

test("Select All Visible and Select All Matching produce distinct explicit sets", () => {
  const visible = rows.slice(0, 2);
  expect(selectFacilityIds([], visible)).toEqual(["facility-burruss", "facility-central"]);
  expect(selectFacilityIds([], rows)).toEqual(["facility-burruss", "facility-central", "facility-south", "facility-ready", "facility-no-report"]);
  expect(clearFacilitySelection()).toEqual([]);
});

test("filter changes do not add selections and hidden selections remain visible in the summary", () => {
  const selected = ["facility-burruss", "facility-central", "facility-south"];
  const snapshot = [...selected];
  const visible = filterFacilityReadinessRows(rows, {
    ...DEFAULT_FACILITY_READINESS_FILTERS,
    search: "Burruss",
  });
  expect(selected).toEqual(snapshot);
  expect(facilitySelectionSummary(selected, visible)).toEqual({
    selectedCount: 3,
    visibleSelectedCount: 1,
    hiddenSelectedCount: 2,
  });
});

test("bulk labels contain the exact selected count and zero selection remains zero", () => {
  expect(facilityBulkActionLabel("Preview", 0)).toBe("Preview 0 Selected");
  expect(facilityBulkActionLabel("Download", 8)).toBe("Download 8 Selected");
  expect(selectFacilityIds([], [])).toEqual([]);
});

test.each([
  [{ resolutionAction: "Add FTE", requisitionId: "req-1", requisitionNumber: "SYN-1" }, ["requisition", "req-1", "fte"]],
  [{ resolutionAction: "Add Shift", requisitionId: "req-2", requisitionNumber: "SYN-2" }, ["requisition", "req-2", "shiftPreference"]],
  [{ resolutionAction: "Add Contact", facilityId: "facility-1", facilityName: "Central" }, ["facility", "facility-1", "facilityContact"]],
  [{ resolutionAction: "Resolve Facility", requisitionId: "req-3", requisitionNumber: "SYN-3" }, ["requisition", "req-3", "siteName"]],
  [{ resolutionAction: "Resolve Facility", candidateId: "candidate-1", identifier: "Synthetic Candidate 001" }, ["candidate", "candidate-1", "facility"]],
])("$resolutionAction opens the exact affected record and field", (issue, expected) => {
  const route = buildReportingCorrectionRoute(issue, {
    reportsTab: "facility",
    filters: { ...DEFAULT_FACILITY_READINESS_FILTERS, search: "Central" },
    selectedFacilityIds: ["facility-1"],
    expandedIssueCode: "MISSING_REQUIRED_SHIFT",
  });
  expect([route.recordType, route.recordId, route.field]).toEqual(expected);
  expect(route.reportingContext).toEqual({
    reportsTab: "facility",
    filters: { ...DEFAULT_FACILITY_READINESS_FILTERS, search: "Central" },
    selectedFacilityIds: ["facility-1"],
    expandedIssueCode: "MISSING_REQUIRED_SHIFT",
  });
});

test("building a correction route does not modify the issue or reporting context", () => {
  const issue = { resolutionAction: "Add Shift", requisitionId: "req-2" };
  const context = { filters: { ...DEFAULT_FACILITY_READINESS_FILTERS }, selectedFacilityIds: ["facility-1"] };
  const before = JSON.stringify({ issue, context });
  buildReportingCorrectionRoute(issue, context);
  expect(JSON.stringify({ issue, context })).toBe(before);
});

test("contact correction preserves the exact facility and report audience context", () => {
  const route = buildReportingCorrectionRoute({
    resolutionAction: "Add Contact",
    facilityId: "facility-1",
    facilityName: "Synthetic Central",
  }, {
    reportsTab: "review-reports",
    selectedFacilityIds: ["facility-1"],
    audience: "Regional",
    recipientGroup: "Regional Manager",
  });

  expect(route).toMatchObject({
    recordType: "facility",
    recordId: "facility-1",
    field: "facilityContact",
    reportingContext: {
      reportsTab: "review-reports",
      selectedFacilityIds: ["facility-1"],
      audience: "Regional",
      recipientGroup: "Regional Manager",
    },
  });
});
