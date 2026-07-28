const text = (value) => String(value ?? "").trim();

export class ReportRowContractError extends TypeError {
  constructor(label, value) {
    const shape = value === null
      ? "null"
      : Array.isArray(value)
        ? "array"
        : typeof value;
    super(`${label} must be an array or an object with a rows array; received ${shape}.`);
    this.name = "ReportRowContractError";
    this.code = "INVALID_REPORT_ROWS";
  }
}

export function normalizeReportRows(value, label = "Report rows") {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.rows)) return value.rows;
  throw new ReportRowContractError(label, value);
}

export function policyRowsForReportAction({
  rows,
  facilityReadinessRows,
  reportActionEligibleRows,
}) {
  const requested = normalizeReportRows(rows, "Selected report rows");
  const available = normalizeReportRows(facilityReadinessRows, "Facility readiness rows");
  if (typeof reportActionEligibleRows !== "function") {
    throw new TypeError("reportActionEligibleRows must be a function.");
  }
  const ids = new Set(requested.map((row) => row?.facilityId || row?.id).filter(Boolean));
  return reportActionEligibleRows(available.filter((row) => ids.has(row?.facilityId || row?.id)));
}

export const REPORT_AUDIENCE_CONTEXT = Object.freeze({
  Facility: Object.freeze({
    audience: "Facility",
    reportType: "Facility Weekly Report",
    recipientGroup: "Facility Contacts",
    attachmentType: "Facility recruiting workbook",
    attachmentPrefix: "facility-reports",
  }),
  Regional: Object.freeze({
    audience: "Regional",
    reportType: "Regional Manager Summary",
    recipientGroup: "Regional Manager",
    attachmentType: "Regional recruiting workbook",
    attachmentPrefix: "regional-summary",
  }),
  Executive: Object.freeze({
    audience: "Executive",
    reportType: "C-Suite Leadership Report",
    recipientGroup: "C-Suite",
    attachmentType: "Executive recruiting workbook",
    attachmentPrefix: "executive-summary",
  }),
});

export function reportAudienceDefinition(value) {
  return REPORT_AUDIENCE_CONTEXT[text(value)] || REPORT_AUDIENCE_CONTEXT.Facility;
}

const unique = (values = []) => Array.from(new Set(values.map(text).filter(Boolean)));

export function buildCanonicalReportScope({
  audience,
  rows,
  reportType = "",
  recipient = "",
  recipientGroup = "",
} = {}) {
  const definition = reportAudienceDefinition(audience);
  const selectedRows = normalizeReportRows(rows, "Canonical report scope rows");
  return {
    ...definition,
    reportType: text(reportType) || definition.reportType,
    recipient: text(recipient) || text(recipientGroup) || definition.recipientGroup,
    recipientGroup: text(recipientGroup) || definition.recipientGroup,
    selectedReportIds: unique(selectedRows.map((row) => row?.id || row?.facilityId)),
    includedFacilityIds: unique(selectedRows.map((row) => row?.facilityId || row?.id)),
    includedRequisitionIds: unique(selectedRows.flatMap((row) => (
      Array.isArray(row?.activeReqs)
        ? row.activeReqs.map((requisition) => requisition?.id || requisition?.requisitionId)
        : []
    ))),
    regionIds: unique(selectedRows.map((row) => row?.regionId)),
  };
}

function safeFilePart(value, fallback) {
  const normalized = text(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

export function buildCanonicalReportContext({
  audience,
  rows,
  scope,
  reportType,
  recipient,
  recipientGroup,
  reportStartDate,
  reportEndDate,
  content,
  workbookSheets,
  generatedAt = "",
}) {
  const selectedRows = normalizeReportRows(rows, "Canonical report context rows");
  const reportScope = scope || buildCanonicalReportScope({
    audience,
    rows: selectedRows,
    reportType,
    recipient,
    recipientGroup,
  });
  const definition = reportAudienceDefinition(reportScope.audience || audience);
  const sheets = normalizeReportRows(workbookSheets, "Canonical report context workbook sheets");
  const singleFacility = definition.audience === "Facility" && selectedRows.length === 1;
  const attachmentStem = singleFacility
    ? safeFilePart(selectedRows[0]?.facility, "facility")
    : definition.attachmentPrefix;
  return {
    ...reportScope,
    reportId: selectedRows.length === 1 ? text(selectedRows[0]?.id || selectedRows[0]?.facilityId) : "",
    subject: text(content?.subject) || `${definition.reportType}: ${reportStartDate} to ${reportEndDate}`,
    body: String(content?.body ?? ""),
    attachmentName: `welcomeflow-${attachmentStem}-${reportStartDate || "report"}.xls`,
    workbookSheets: sheets,
    workbookTabs: sheets.map((sheet) => text(sheet?.name)).filter(Boolean),
    reportingPeriod: `${reportStartDate || ""} to ${reportEndDate || ""}`,
    generatedAt: text(generatedAt),
    dataThrough: text(reportEndDate),
  };
}

export function previewSelectedReportsLabel(count) {
  const numeric = Number(count) || 0;
  return `Preview ${numeric} Selected Report${numeric === 1 ? "" : "s"}`;
}

export function readReportReviewTarget(search = "") {
  const params = new URLSearchParams(String(search || "").replace(/^\?/, ""));
  return text(params.get("reportId"));
}

export function reportReviewSearch(search = "", reportId = "") {
  const params = new URLSearchParams(String(search || "").replace(/^\?/, ""));
  const id = text(reportId);
  if (id) params.set("reportId", id);
  else params.delete("reportId");
  const query = params.toString();
  return query ? `?${query}` : "";
}
