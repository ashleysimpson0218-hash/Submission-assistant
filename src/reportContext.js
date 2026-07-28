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
const REPORT_REVIEW_TARGET_VERSION = "wf-report-v1";

export function createReportReviewTargetId({
  audience,
  reportType,
  rows,
} = {}) {
  const selectedRows = normalizeReportRows(rows, "Report review target rows");
  const definition = reportAudienceDefinition(audience);
  const reportIds = unique(selectedRows.map((row) => row?.id || row?.facilityId)).sort();
  if (!reportIds.length) return "";
  return [
    REPORT_REVIEW_TARGET_VERSION,
    encodeURIComponent(definition.audience),
    encodeURIComponent(text(reportType) || definition.reportType),
    reportIds.map((id) => encodeURIComponent(id)).join(","),
  ].join("|");
}

export function parseReportReviewTargetId(value = "") {
  const targetId = text(value);
  if (!targetId) return { targetId: "", reportIds: [], audience: "", reportType: "", legacy: false };
  const parts = targetId.split("|");
  if (parts.length !== 4 || parts[0] !== REPORT_REVIEW_TARGET_VERSION) {
    return {
      targetId,
      reportIds: [targetId],
      audience: REPORT_AUDIENCE_CONTEXT.Facility.audience,
      reportType: REPORT_AUDIENCE_CONTEXT.Facility.reportType,
      legacy: true,
    };
  }
  try {
    return {
      targetId,
      reportIds: parts[3].split(",").filter(Boolean).map((id) => decodeURIComponent(id)),
      audience: decodeURIComponent(parts[1]),
      reportType: decodeURIComponent(parts[2]),
      legacy: false,
    };
  } catch {
    return { targetId, reportIds: [], audience: "", reportType: "", legacy: false };
  }
}

export function resolveReportReviewTarget(rows = [], targetId = "") {
  const availableRows = normalizeReportRows(rows, "Report review lookup rows");
  const parsed = parseReportReviewTargetId(targetId);
  if (!parsed.targetId) return { status: "missing", ...parsed, rows: [], missingReportIds: [] };
  const byId = new Map(availableRows.map((row) => [text(row?.id || row?.facilityId), row]).filter(([id]) => id));
  const resolvedRows = parsed.reportIds.map((id) => byId.get(id)).filter(Boolean);
  const missingReportIds = parsed.reportIds.filter((id) => !byId.has(id));
  if (!parsed.reportIds.length || missingReportIds.length) {
    return { status: "not-found", ...parsed, rows: resolvedRows, missingReportIds };
  }
  return { status: "found", ...parsed, rows: resolvedRows, missingReportIds: [] };
}

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
    reportId: createReportReviewTargetId({
      audience: reportScope.audience || audience,
      reportType: reportScope.reportType || reportType,
      rows: selectedRows,
    }),
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
