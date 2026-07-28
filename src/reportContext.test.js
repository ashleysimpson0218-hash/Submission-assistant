import {
  ReportRowContractError,
  buildCanonicalReportContext,
  normalizeReportRows,
  policyRowsForReportAction,
  previewSelectedReportsLabel,
  readReportReviewTarget,
  reportAudienceDefinition,
  reportReviewSearch,
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

test("deep links retain the stable report target and preserve unrelated query values", () => {
  const search = reportReviewSearch("?workspace=synthetic", "facility-2");
  expect(readReportReviewTarget(search)).toBe("facility-2");
  expect(search).toContain("workspace=synthetic");
  expect(readReportReviewTarget(reportReviewSearch(search, ""))).toBe("");
});

test("selected preview wording uses correct singular and plural grammar", () => {
  expect(previewSelectedReportsLabel(1)).toBe("Preview 1 Selected Report");
  expect(previewSelectedReportsLabel(2)).toBe("Preview 2 Selected Reports");
});
