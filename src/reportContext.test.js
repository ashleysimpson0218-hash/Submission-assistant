import {
  ReportRowContractError,
  buildReportReviewNavigation,
  buildReportingNavigation,
  buildCanonicalReportContext,
  buildCanonicalReportScope,
  buildAudienceReportGroups,
  createReportReviewTargetId,
  normalizeReportRows,
  parseReportReviewTargetId,
  policyRowsForReportAction,
  previewSelectedReportsLabel,
  readReportReviewTarget,
  reportAudienceDefinition,
  reportReviewSearch,
  resolveReportReviewTarget,
  serializeCanonicalReportHistoryRecord,
} from "./reportContext";

const rows = [
  { id: "facility-1", facilityId: "facility-1", facility: "Synthetic North" },
  { id: "facility-2", facilityId: "facility-2", facility: "Synthetic South" },
];

test("normalizes documented report-row response shapes without discarding rows", () => {
  expect(normalizeReportRows(rows)).toBe(rows);
  expect(normalizeReportRows({ rows })).toBe(rows);
});

test("invalid report-row shapes produce a controlled developer contract error", () => {
  expect(() => normalizeReportRows({ target: {} }, "Preview rows")).toThrow(ReportRowContractError);
  expect(() => normalizeReportRows({ target: {} }, "Preview rows")).toThrow(
    "Preview rows must be an array or an object with a rows array",
  );
});

test("policy rows preserve one and multiple selected reports, including no-policy rows", () => {
  const eligibility = (value) => value.filter((row) => row.reportActionEligible !== false);
  const available = [
    { ...rows[0], reportActionEligible: true, policy: "ask-weekly" },
    { ...rows[1], reportActionEligible: true },
    { id: "facility-3", facilityId: "facility-3", reportActionEligible: false },
  ];
  expect(policyRowsForReportAction({
    rows: [rows[0]],
    facilityReadinessRows: available,
    reportActionEligibleRows: eligibility,
  })).toEqual([available[0]]);
  expect(policyRowsForReportAction({
    rows: { rows },
    facilityReadinessRows: available,
    reportActionEligibleRows: eligibility,
  })).toEqual(available.slice(0, 2));
});

test.each([
  ["Facility", "Facility Weekly Report", "Facility Contacts", "facility-reports"],
  ["Regional", "Regional Manager Summary", "Regional Manager", "regional-summary"],
  ["Executive", "C-Suite Leadership Report", "C-Suite", "executive-summary"],
])("defines one synchronized %s audience contract", (audience, reportType, recipientGroup, attachmentPrefix) => {
  expect(reportAudienceDefinition(audience)).toEqual(expect.objectContaining({
    audience,
    reportType,
    recipientGroup,
    attachmentPrefix,
  }));
});

test("canonical report context changes body, recipient, report type, and attachment together", () => {
  const contexts = ["Facility", "Regional", "Executive"].map((audience) => buildCanonicalReportContext({
    audience,
    rows,
    reportStartDate: "2026-07-27",
    reportEndDate: "2026-07-28",
    content: { subject: `${audience} subject`, body: `${audience} body` },
    workbookSheets: [{ name: `${audience} Summary` }],
  }));

  expect(contexts.map((context) => context.body)).toEqual(["Facility body", "Regional body", "Executive body"]);
  expect(contexts.map((context) => context.recipientGroup)).toEqual(["Facility Contacts", "Regional Manager", "C-Suite"]);
  expect(contexts.map((context) => context.reportType)).toEqual(["Facility Weekly Report", "Regional Manager Summary", "C-Suite Leadership Report"]);
  expect(contexts.map((context) => context.attachmentName)).toEqual([
    "welcomeflow-facility-reports-2026-07-27.xls",
    "welcomeflow-regional-summary-2026-07-27.xls",
    "welcomeflow-executive-summary-2026-07-27.xls",
  ]);
});

test.each(["Facility", "Regional", "Executive"])("serializes %s history from the canonical preview context", (audience) => {
  const scopeRows = rows.map((row, index) => ({
    ...row,
    regionId: "region-1",
    regionName: "Synthetic Region",
    activeReqs: [{ id: `req-${index + 1}` }],
    candidates: [{ id: `candidate-${index + 1}` }],
  }));
  const context = buildCanonicalReportContext({
    audience,
    rows: audience === "Facility" ? [scopeRows[0]] : scopeRows,
    reportStartDate: "2026-07-27",
    reportEndDate: "2026-07-28",
    content: { subject: `${audience} subject`, body: `${audience} body` },
    workbookSheets: [{ name: `${audience} Summary` }],
    canonicalTotals: { facilities: audience === "Facility" ? 1 : 2, requisitions: audience === "Facility" ? 1 : 2 },
    generatedAt: "2026-07-28T12:00:00.000Z",
  });
  const record = serializeCanonicalReportHistoryRecord({
    context,
    id: `${audience.toLowerCase()}-history`,
    status: "Sent",
    generatedBy: "Synthetic Recruiter",
    sentStatus: "Sent",
  });

  expect(record).toEqual(expect.objectContaining({
    id: `${audience.toLowerCase()}-history`,
    reportId: context.reportId,
    stableReportId: context.reportId,
    audience,
    recipientGroup: context.recipientGroup,
    reportType: context.reportType,
    emailSubject: `${audience} subject`,
    emailBody: `${audience} body`,
    attachmentName: context.attachmentName,
    attachmentType: context.attachmentType,
    workbookTabs: [`${audience} Summary`],
    reportIds: context.selectedReportIds,
    facilityIds: context.includedFacilityIds,
    requisitionIds: context.includedRequisitionIds,
    candidateIds: context.includedCandidateIds,
    canonicalTotals: context.canonicalTotals,
    status: "Sent",
  }));
});

test("saved canonical history remains immutable when a later audience context changes", () => {
  const regionalContext = buildCanonicalReportContext({
    audience: "Regional",
    rows,
    reportStartDate: "2026-07-27",
    reportEndDate: "2026-07-28",
    content: { subject: "Regional subject", body: "Regional body" },
    workbookSheets: [{ name: "Regional Summary" }],
  });
  const saved = serializeCanonicalReportHistoryRecord({ context: regionalContext, id: "saved-regional" });
  const before = JSON.stringify(saved);

  buildCanonicalReportContext({
    audience: "Executive",
    rows,
    reportStartDate: "2026-07-27",
    reportEndDate: "2026-07-28",
    content: { subject: "Executive subject", body: "Executive body" },
    workbookSheets: [{ name: "Executive Summary" }],
  });

  expect(JSON.stringify(saved)).toBe(before);
  expect(saved.emailBody).toBe("Regional body");
  expect(saved.attachmentName).toBe("welcomeflow-regional-summary-2026-07-27.xls");
});

test("canonical scope preserves one included facility set for report metadata and workbook construction", () => {
  const scopeRows = [
    {
      ...rows[0],
      regionId: "region-1",
      activeReqs: [{ id: "req-1" }, { requisitionId: "req-2" }],
    },
    {
      ...rows[1],
      regionId: "region-1",
      activeReqs: [{ id: "req-3" }],
    },
  ];
  const scope = buildCanonicalReportScope({
    audience: "Regional",
    rows: scopeRows,
    recipientGroup: "Regional Manager",
  });
  const workbookSheets = [
    { name: "Regional Summary", rows: [{ facilityId: "facility-1" }, { facilityId: "facility-2" }] },
    { name: "Synthetic North", rows: [] },
    { name: "Synthetic South", rows: [] },
  ];
  const context = buildCanonicalReportContext({
    audience: "Regional",
    rows: scopeRows,
    scope,
    reportStartDate: "2026-07-27",
    reportEndDate: "2026-07-28",
    content: { subject: "Regional subject", body: "Facilities included: Synthetic North, Synthetic South" },
    workbookSheets,
  });

  expect(context.includedFacilityIds).toEqual(["facility-1", "facility-2"]);
  expect(context.includedRequisitionIds).toEqual(["req-1", "req-2", "req-3"]);
  expect(context.regionIds).toEqual(["region-1"]);
  expect(context.recipient).toBe("Regional Manager");
  expect(context.workbookTabs).toEqual(["Regional Summary", "Synthetic North", "Synthetic South"]);
});

test("repeated audience switching replaces recipient, attachment, and facility scope without stale values", () => {
  const third = { id: "facility-3", facilityId: "facility-3", facility: "Synthetic East", regionId: "region-2" };
  const sequence = [
    { audience: "Facility", rows: [rows[0]] },
    { audience: "Regional", rows },
    { audience: "Executive", rows: [...rows, third] },
    { audience: "Regional", rows },
    { audience: "Facility", rows: [rows[0]] },
  ].map(({ audience, rows: selectedRows }) => buildCanonicalReportContext({
    audience,
    rows: selectedRows,
    reportStartDate: "2026-07-27",
    reportEndDate: "2026-07-28",
    content: { subject: `${audience} subject`, body: `${audience}: ${selectedRows.map((row) => row.facility).join(", ")}` },
    workbookSheets: selectedRows.map((row) => ({ name: row.facility, rows: [{ facilityId: row.facilityId }] })),
  }));

  expect(sequence.map((context) => context.includedFacilityIds)).toEqual([
    ["facility-1"],
    ["facility-1", "facility-2"],
    ["facility-1", "facility-2", "facility-3"],
    ["facility-1", "facility-2"],
    ["facility-1"],
  ]);
  expect(sequence.map((context) => context.recipientGroup)).toEqual([
    "Facility Contacts",
    "Regional Manager",
    "C-Suite",
    "Regional Manager",
    "Facility Contacts",
  ]);
  sequence.forEach((context) => {
    expect(context.workbookTabs).toEqual(
      context.includedFacilityIds.map((facilityId) => ({
        "facility-1": "Synthetic North",
        "facility-2": "Synthetic South",
        "facility-3": "Synthetic East",
      })[facilityId]),
    );
  });
});

test("audience report groups replace facility details with canonical regional and executive scopes", () => {
  const scopedRows = [
    { ...rows[0], regionId: "region-1", regionName: "North", readiness: "Ready" },
    { ...rows[1], regionId: "region-1", regionName: "North", readiness: "Ready" },
    { id: "facility-3", facilityId: "facility-3", facility: "Synthetic East", regionId: "region-2", regionName: "East", readiness: "Needs Review" },
  ];

  const facilityGroups = buildAudienceReportGroups({ audience: "Facility", rows: [scopedRows[0]] });
  const regionalGroups = buildAudienceReportGroups({ audience: "Regional", rows: scopedRows });
  const executiveGroups = buildAudienceReportGroups({ audience: "Executive", rows: scopedRows });

  expect(facilityGroups).toHaveLength(1);
  expect(facilityGroups[0]).toMatchObject({
    title: "Synthetic North",
    includedFacilityIds: ["facility-1"],
    reportIds: ["facility-1"],
  });
  expect(regionalGroups.map((group) => ({
    title: group.title,
    facilityIds: group.includedFacilityIds,
    status: group.status,
  }))).toEqual([
    { title: "North", facilityIds: ["facility-1", "facility-2"], status: "Ready" },
    { title: "East", facilityIds: ["facility-3"], status: "Needs Review" },
  ]);
  expect(executiveGroups).toHaveLength(1);
  expect(executiveGroups[0]).toMatchObject({
    audience: "Executive",
    includedFacilityIds: ["facility-1", "facility-2", "facility-3"],
    reportIds: ["facility-1", "facility-2", "facility-3"],
    status: "Needs Review",
  });
});

test("one facility context uses that facility attachment without mutating source rows", () => {
  const source = [{ ...rows[0] }];
  const before = JSON.stringify(source);
  const context = buildCanonicalReportContext({
    audience: "Facility",
    rows: source,
    reportStartDate: "2026-07-27",
    reportEndDate: "2026-07-28",
    content: { subject: "Facility subject", body: "Facility body" },
    workbookSheets: [],
  });
  expect(context.attachmentName).toBe("welcomeflow-synthetic-north-2026-07-27.xls");
  expect(JSON.stringify(source)).toBe(before);
});

test("deep links retain the exact stable report target and preserve unrelated query values", () => {
  const targetId = createReportReviewTargetId({
    audience: "Regional",
    reportType: "Regional Manager Summary",
    rows,
  });
  const search = reportReviewSearch("?workspace=synthetic", targetId);
  expect(readReportReviewTarget(search)).toBe(targetId);
  expect(search).toContain("workspace=synthetic");
  expect(readReportReviewTarget(reportReviewSearch(search, ""))).toBe("");
  expect(parseReportReviewTargetId(targetId)).toEqual({
    targetId,
    reportIds: ["facility-1", "facility-2"],
    audience: "Regional",
    reportType: "Regional Manager Summary",
    legacy: false,
  });
});

test("Facility Readiness and Reports & History share one versioned review navigation contract", () => {
  const fromFacilityReadiness = buildReportReviewNavigation({
    search: "?workspace=synthetic",
    audience: "Facility",
    reportType: "Facility Weekly Report",
    rows: [rows[0]],
  });
  const fromReportsHistory = buildReportReviewNavigation({
    search: "?workspace=synthetic",
    audience: "Facility",
    reportType: "Facility Weekly Report",
    rows: [rows[0]],
  });

  expect(fromFacilityReadiness).toEqual(fromReportsHistory);
  expect(fromFacilityReadiness.reportId).toMatch(/^wf-report-v1\|/);
  expect(readReportReviewTarget(fromFacilityReadiness.search)).toBe(fromFacilityReadiness.reportId);
  expect(fromFacilityReadiness.state).toEqual({
    activePage: "reports",
    reportsTab: "review-reports",
    reportReviewTargetId: fromFacilityReadiness.reportId,
  });
});

test("reporting navigation removes only the stable target and preserves a deterministic history destination", () => {
  const target = buildReportReviewNavigation({
    search: "?workspace=synthetic&view=compact",
    audience: "Regional",
    rows,
  });
  const away = buildReportingNavigation({
    search: target.search,
    activePage: "reporting",
    reportsTab: "reports-history",
  });

  expect(readReportReviewTarget(away.search)).toBe("");
  expect(away.search).toContain("workspace=synthetic");
  expect(away.search).toContain("view=compact");
  expect(away.state).toEqual({
    activePage: "reporting",
    reportsTab: "reports-history",
    reportReviewTargetId: "",
  });
});

test("stable report targets restore the exact rows after reload and reject unavailable IDs", () => {
  const targetId = createReportReviewTargetId({
    audience: "Executive",
    reportType: "C-Suite Leadership Report",
    rows: [rows[1]],
  });

  expect(resolveReportReviewTarget(rows, targetId)).toMatchObject({
    status: "found",
    targetId,
    reportIds: ["facility-2"],
    audience: "Executive",
    reportType: "C-Suite Leadership Report",
    rows: [rows[1]],
    missingReportIds: [],
  });

  const invalidTarget = createReportReviewTargetId({
    audience: "Facility",
    reportType: "Facility Weekly Report",
    rows: [{ id: "missing-report" }],
  });
  expect(resolveReportReviewTarget(rows, invalidTarget)).toMatchObject({
    status: "not-found",
    rows: [],
    missingReportIds: ["missing-report"],
  });
});

test("legacy facility-only report targets remain readable without changing report-history identity", () => {
  expect(resolveReportReviewTarget(rows, "facility-2")).toMatchObject({
    status: "found",
    reportIds: ["facility-2"],
    audience: "Facility",
    reportType: "Facility Weekly Report",
    rows: [rows[1]],
    legacy: true,
  });
});

test("selected preview wording uses correct singular and plural grammar", () => {
  expect(previewSelectedReportsLabel(1)).toBe("Preview 1 Selected Report");
  expect(previewSelectedReportsLabel(2)).toBe("Preview 2 Selected Reports");
});
