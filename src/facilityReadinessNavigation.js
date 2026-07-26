const text = (value) => String(value ?? "").trim();
const values = (value) => Array.isArray(value) ? value : [];

export const DEFAULT_FACILITY_READINESS_FILTERS = Object.freeze({
  search: "",
  regionId: "All Regions",
  readiness: "Needs Action",
  reportType: "All Report Types",
});

export const FACILITY_READINESS_OPTIONS = [
  "Needs Action",
  "Blocked",
  "Needs Review",
  "Ready",
  "No Report Required",
  "Scheduled",
  "Sent",
  "Not Started",
  "All",
];

export function facilityReadinessFor(row = {}, issues = []) {
  if (row.policyReadiness === "No Report Required") return "No Report Required";
  if (values(issues).some((issue) => issue?.blocking)) return "Blocked";
  if (row.policyReadiness) return row.policyReadiness;
  if (row.status === "Missing Contact") return "Blocked";
  if (row.status === "Needs Review") return "Needs Review";
  if (row.status === "Sent") return "Sent";
  if (row.status === "Scheduled") return "Scheduled";
  if (["Ready", "Ready to Send"].includes(row.status)) return "Ready";
  return "Not Started";
}

export function withFacilityReadiness(row = {}, issues = []) {
  return {
    ...row,
    aliases: values(row.aliases).map(text).filter(Boolean),
    readinessIssues: values(issues),
    readiness: facilityReadinessFor(row, issues),
  };
}

export function facilityMatchesReadiness(row = {}, readiness = "Needs Action") {
  if (readiness === "All") return true;
  if (readiness === "Needs Action") return ["Blocked", "Needs Review"].includes(row.readiness);
  return row.readiness === readiness;
}

function matchesNonReadinessFilters(row = {}, filters = {}) {
  const query = text(filters.search).toLowerCase();
  const searchable = [
    row.facility,
    row.facilityName,
    row.originalFacilityLabel,
    row.facilityId,
    row.facilityCode,
    ...values(row.aliases),
  ].map(text).join(" ").toLowerCase();
  if (query && !searchable.includes(query)) return false;
  if (filters.regionId && filters.regionId !== "All Regions" && row.regionId !== filters.regionId) return false;
  if (filters.reportType && filters.reportType !== "All Report Types" && row.reportType !== filters.reportType) return false;
  return true;
}

export function filterFacilityReadinessRows(rows = [], filters = DEFAULT_FACILITY_READINESS_FILTERS) {
  return values(rows).filter((row) => (
    matchesNonReadinessFilters(row, filters)
    && facilityMatchesReadiness(row, filters.readiness || DEFAULT_FACILITY_READINESS_FILTERS.readiness)
  ));
}

export function facilityReadinessCounts(rows = [], filters = DEFAULT_FACILITY_READINESS_FILTERS) {
  const scoped = values(rows).filter((row) => matchesNonReadinessFilters(row, filters));
  const count = (readiness) => scoped.filter((row) => facilityMatchesReadiness(row, readiness)).length;
  return {
    All: scoped.length,
    "Needs Action": count("Needs Action"),
    Blocked: count("Blocked"),
    "Needs Review": count("Needs Review"),
    Ready: count("Ready"),
    "No Report Required": count("No Report Required"),
    Scheduled: count("Scheduled"),
    Sent: count("Sent"),
    "Not Started": count("Not Started"),
  };
}

export function selectFacilityIds(currentIds = [], rows = []) {
  return Array.from(new Set([...values(currentIds).map(text), ...values(rows).map((row) => text(row.id || row.facilityId)).filter(Boolean)]));
}

export function clearFacilitySelection() {
  return [];
}

export function facilitySelectionSummary(selectedIds = [], visibleRows = []) {
  const selected = new Set(values(selectedIds).map(text));
  const visible = new Set(values(visibleRows).map((row) => text(row.id || row.facilityId)).filter(Boolean));
  const visibleSelected = Array.from(selected).filter((id) => visible.has(id)).length;
  return {
    selectedCount: selected.size,
    visibleSelectedCount: visibleSelected,
    hiddenSelectedCount: Math.max(0, selected.size - visibleSelected),
  };
}

export function facilityBulkActionLabel(action, selectedCount) {
  return `${text(action)} ${Number(selectedCount) || 0} Selected`;
}

function cloneReportingContext(context = {}) {
  return {
    reportsTab: context.reportsTab || "facility",
    filters: { ...(context.filters || DEFAULT_FACILITY_READINESS_FILTERS) },
    selectedFacilityIds: [...values(context.selectedFacilityIds)],
    expandedIssueCode: text(context.expandedIssueCode),
  };
}

export function buildReportingCorrectionRoute(issue = {}, context = {}) {
  const action = text(issue.resolutionAction);
  const preservedContext = cloneReportingContext(context);
  const base = {
    action,
    field: "",
    page: "positions",
    tab: "facilities",
    recordType: "facility",
    recordId: text(issue.facilityId),
    label: text(issue.facilityName || issue.originalFacilityLabel || issue.identifier),
    reportingContext: preservedContext,
  };

  if (action === "Add FTE" || action === "Add Shift") {
    return {
      ...base,
      page: "positions",
      tab: "positions",
      recordType: "requisition",
      recordId: text(issue.requisitionId),
      field: action === "Add FTE" ? "fte" : "shiftPreference",
      label: text(issue.requisitionNumber || issue.identifier),
    };
  }
  if (action === "Add Contact") {
    return { ...base, field: "facilityContact" };
  }
  if (action === "Resolve Facility" && issue.requisitionId) {
    return {
      ...base,
      page: "positions",
      tab: "positions",
      recordType: "requisition",
      recordId: text(issue.requisitionId),
      field: "siteName",
      label: text(issue.requisitionNumber || issue.identifier),
    };
  }
  if (action === "Resolve Facility" && issue.candidateId) {
    return {
      ...base,
      page: "workspace",
      tab: "overview",
      recordType: "candidate",
      recordId: text(issue.candidateId),
      field: "facility",
      label: text(issue.identifier),
    };
  }
  return { ...base, field: "siteName" };
}
