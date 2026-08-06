export const REPORT_SCOPE_OPTIONS = [
  { id: "all-active", label: "All Active Facilities" },
  { id: "selected-facilities", label: "Selected Facilities" },
  { id: "region", label: "Region" },
  { id: "regional-contact", label: "Regional Manager or Director" },
];

export const WORKBOOK_LAYOUT_OPTIONS = [
  "Single Detail Sheet",
  "Summary + Detail",
  "Summary + Facility Tabs",
  "Summary + Regional Tabs",
];

export const REGIONAL_CONTACT_ROLES = [
  "Regional Manager",
  "Regional Director",
  "Area Manager",
  "Regional Recruiter",
  "Regional Clinical Director",
  "Other Regional Contact",
];

export const REPORT_COLUMNS = [
  { id: "candidateName", label: "Candidate Name", default: true },
  { id: "candidateType", label: "Candidate Type", default: true },
  { id: "candidateSource", label: "Candidate Source", default: false },
  { id: "facility", label: "Facility", default: true },
  { id: "facilityId", label: "Facility ID", default: true },
  { id: "facilityCode", label: "Facility Code", default: false },
  { id: "originalFacilityLabel", label: "Original Facility Label", default: false },
  { id: "region", label: "Region", default: true },
  { id: "regionalContact", label: "Regional Manager or Director", default: false },
  { id: "position", label: "Position", default: true },
  { id: "reqNumber", label: "Req Number", default: true },
  { id: "uniqueIdNumber", label: "Requisition Unique ID", default: true },
  { id: "employmentType", label: "Employment Type", default: false },
  { id: "shift", label: "Shift", default: false },
  { id: "fte", label: "FTE", default: false },
  { id: "weeklyHours", label: "Weekly Hours", default: false },
  { id: "benefitsEligible", label: "Benefits Eligibility", default: false },
  { id: "candidateStatus", label: "Candidate Status", default: true },
  { id: "pipelineStage", label: "Pipeline Stage", default: true },
  { id: "riskLevel", label: "Risk Level", default: false },
  { id: "riskReason", label: "Risk Reason", default: false },
  { id: "nextAction", label: "Next Action", default: true },
  { id: "waitingOn", label: "Waiting On", default: true },
  { id: "candidateNotes", label: "Candidate Notes", default: false },
  { id: "recruiterNotes", label: "Recruiter Notes", default: false },
  { id: "actionHistory", label: "Action History", default: false },
  { id: "submittedDate", label: "Submitted Date", default: true },
  { id: "daysAging", label: "Days Aging", default: true },
  { id: "interviewDate", label: "Interview Date", default: false },
  { id: "offerStatus", label: "Offer Status", default: false },
  { id: "tentativeStartDate", label: "Tentative Start Date", default: false },
  { id: "confirmedStartDate", label: "Confirmed Start Date", default: false },
  { id: "recruiterOwner", label: "Recruiter Owner", default: false },
];

export const DEFAULT_REPORT_COLUMN_IDS = REPORT_COLUMNS.filter((column) => column.default).map((column) => column.id);

const PRESET_COLUMNS = {
  default: DEFAULT_REPORT_COLUMN_IDS,
  full: REPORT_COLUMNS.map((column) => column.id),
  leadership: ["facility", "facilityId", "region", "position", "reqNumber", "candidateStatus", "pipelineStage", "nextAction", "daysAging", "recruiterOwner"],
  regional: ["candidateName", "facility", "facilityId", "region", "position", "reqNumber", "candidateStatus", "nextAction", "waitingOn", "daysAging"],
};

export function createDefaultReportPresets() {
  return [
    { id: "weekly-cleanup-default", name: "Weekly Cleanup Default", selectedColumns: [...PRESET_COLUMNS.default], columnOrder: [...PRESET_COLUMNS.default], facilityScope: "all-active", selectedFacilityIds: [], selectedRegionIds: [], selectedRegionalContactIds: [], includeTotals: true, workbookLayout: "Summary + Facility Tabs", system: true },
    { id: "full-candidate-detail", name: "Full Candidate Detail", selectedColumns: [...PRESET_COLUMNS.full], columnOrder: [...PRESET_COLUMNS.full], facilityScope: "all-active", selectedFacilityIds: [], selectedRegionIds: [], selectedRegionalContactIds: [], includeTotals: true, workbookLayout: "Summary + Detail", system: true },
    { id: "leadership-summary", name: "Leadership Summary", selectedColumns: [...PRESET_COLUMNS.leadership], columnOrder: [...PRESET_COLUMNS.leadership], facilityScope: "all-active", selectedFacilityIds: [], selectedRegionIds: [], selectedRegionalContactIds: [], includeTotals: true, workbookLayout: "Summary + Detail", system: true },
    { id: "regional-summary", name: "Regional Summary", selectedColumns: [...PRESET_COLUMNS.regional], columnOrder: [...PRESET_COLUMNS.regional], facilityScope: "region", selectedFacilityIds: [], selectedRegionIds: [], selectedRegionalContactIds: [], includeTotals: true, workbookLayout: "Summary + Regional Tabs", system: true },
  ];
}

const text = (value) => String(value ?? "").trim();
export const normalizeFacilityKey = (value) => text(value).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
const records = (value) => Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
const CLOSED_CANDIDATE_STATUSES = new Set(["archived", "closed", "placed", "rejected", "unresponsive", "not interested", "withdrawn", "withdrew"]);
const uniqueText = (values) => {
  const seen = new Set();
  return (Array.isArray(values) ? values : []).map(text).filter((value) => {
    const key = normalizeFacilityKey(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export function isClosedReportingStatus(status = "") {
  return CLOSED_CANDIDATE_STATUSES.has(text(status).toLowerCase());
}

export function isLiveReportingRequisition(requisition = {}) {
  return text(requisition.status || "Active").toLowerCase() === "active";
}

function actionHistoryLine(event = {}) {
  const timestamp = firstDate(event.timestamp, event.createdAt, event.updatedAt, event.date);
  const action = text(event.type || event.method || event.action || event.subject || event.status);
  const detail = text(event.messageSummary || event.summary || event.detail || event.note || event.notes || event.body);
  return [timestamp, action, detail].filter(Boolean).join(" | ");
}

export function reportingActionHistory(candidate = {}, workspaceHistory = []) {
  const candidateId = text(candidate.id);
  const matchingWorkspaceHistory = records(workspaceHistory).filter((event) => {
    const eventCandidateId = text(event.trackerId || event.candidateId || event.leadId);
    return candidateId && eventCandidateId === candidateId;
  });
  const events = [
    ...records(candidate.communicationEvents),
    ...records(candidate.outreachHistory),
    ...records(candidate.actionHistory),
    ...records(candidate.statusHistory),
    ...records(candidate.feedbackHistory),
    ...records(candidate.atsUpdateHistory),
    ...matchingWorkspaceHistory,
  ];
  const seen = new Set();
  return events
    .map(actionHistoryLine)
    .filter((line) => {
      const key = line.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join("\n");
}

function sanitizedExcelSheetName(name = "Sheet") {
  return text(name || "Sheet").replace(/[\\/?*[\]:]/g, " ").slice(0, 31).trim() || "Sheet";
}

export function uniqueExcelSheetNames(names = []) {
  const used = new Set();
  return (Array.isArray(names) ? names : []).map((name) => {
    const base = sanitizedExcelSheetName(name);
    let candidate = base;
    let suffixNumber = 2;
    while (used.has(candidate.toLowerCase())) {
      const suffix = ` (${suffixNumber})`;
      candidate = `${base.slice(0, Math.max(1, 31 - suffix.length)).trim()}${suffix}`;
      suffixNumber += 1;
    }
    used.add(candidate.toLowerCase());
    return candidate;
  });
}

export function normalizeReportingSettings(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const defaults = createDefaultReportPresets();
  const incomingPresets = records(source.reportPresets);
  const presets = [
    ...incomingPresets.map(normalizePreset),
    ...defaults.filter((preset) => !incomingPresets.some((item) => item.id === preset.id)),
  ];
  return {
    regions: records(source.regions).map((region) => ({ id: text(region.id), name: text(region.name), active: region.active !== false })).filter((region) => region.id && region.name),
    reportPresets: presets,
    facilityDataUpdatedAt: text(source.facilityDataUpdatedAt),
  };
}

export function normalizePreset(preset = {}) {
  const known = new Set(REPORT_COLUMNS.map((column) => column.id));
  const selected = uniqueText(preset.selectedColumns).filter((id) => known.has(id));
  const order = uniqueText(preset.columnOrder).filter((id) => selected.includes(id));
  const missing = selected.filter((id) => !order.includes(id));
  return {
    id: text(preset.id) || `preset-${Date.now()}`,
    name: text(preset.name) || "Custom",
    selectedColumns: selected.length ? selected : [...DEFAULT_REPORT_COLUMN_IDS],
    columnOrder: order.length ? [...order, ...missing] : (selected.length ? selected : [...DEFAULT_REPORT_COLUMN_IDS]),
    facilityScope: REPORT_SCOPE_OPTIONS.some((option) => option.id === preset.facilityScope) ? preset.facilityScope : "all-active",
    selectedFacilityIds: uniqueText(preset.selectedFacilityIds),
    selectedRegionIds: uniqueText(preset.selectedRegionIds),
    selectedRegionalContactIds: uniqueText(preset.selectedRegionalContactIds),
    includeTotals: preset.includeTotals !== false,
    workbookLayout: WORKBOOK_LAYOUT_OPTIONS.includes(preset.workbookLayout) ? preset.workbookLayout : "Summary + Facility Tabs",
    system: Boolean(preset.system),
  };
}

export function normalizeFacilityRecord(site = {}) {
  return {
    ...site,
    id: text(site.id),
    siteName: text(site.siteName),
    facilityCode: text(site.facilityCode),
    aliases: uniqueText(site.aliases),
    regionId: text(site.regionId),
    status: text(site.status) || "Active",
  };
}

export function applyCanonicalFacilityUpdate(previous = {}, draft = {}) {
  const prior = normalizeFacilityRecord(previous);
  const next = normalizeFacilityRecord({ ...previous, ...draft, id: previous.id || draft.id });
  const renamed = prior.siteName && next.siteName && normalizeFacilityKey(prior.siteName) !== normalizeFacilityKey(next.siteName);
  return {
    ...next,
    id: prior.id || next.id,
    aliases: uniqueText([...(prior.aliases || []), ...(next.aliases || []), ...(renamed ? [prior.siteName] : [])]).filter((alias) => normalizeFacilityKey(alias) !== normalizeFacilityKey(next.siteName)),
  };
}

export function buildFacilityIndex(sites = []) {
  const normalizedFacilities = records(sites).map(normalizeFacilityRecord).filter((site) => site.id && site.siteName);
  const uniqueFacilities = new Map();
  normalizedFacilities.forEach((site) => {
    if (!uniqueFacilities.has(site.id)) uniqueFacilities.set(site.id, site);
  });
  const facilities = Array.from(uniqueFacilities.values());
  const byId = new Map(facilities.map((site) => [site.id, site]));
  const byName = new Map();
  const byAlias = new Map();
  const add = (map, key, facility) => {
    if (!key) return;
    map.set(key, [...(map.get(key) || []), facility]);
  };
  facilities.forEach((facility) => {
    add(byName, normalizeFacilityKey(facility.siteName), facility);
    facility.aliases.forEach((alias) => add(byAlias, normalizeFacilityKey(alias), facility));
  });
  return { facilities, byId, byName, byAlias };
}

function exactOne(matches = []) {
  const unique = Array.from(new Map(matches.map((item) => [item.id, item])).values());
  return unique.length === 1 ? unique[0] : null;
}

export function resolveRequisition(candidate = {}, requisitions = []) {
  const form = candidate.formSnapshot || {};
  const stableId = text(candidate.requisitionId || candidate.reqId || candidate.selectedRequisitionId || form.selectedRequisitionId || form.requisitionId);
  if (stableId) {
    const matches = records(requisitions).filter((req) => text(req.id) === stableId);
    return { requisition: exactOne(matches), status: matches.length === 1 ? "resolved" : matches.length ? "ambiguous" : "unmapped", matchedBy: "stable-id" };
  }
  const uniqueId = text(candidate.uniqueIdNumber || form.uniqueIdNumber);
  if (uniqueId) {
    const matches = records(requisitions).filter((req) => text(req.uniqueIdNumber).toLowerCase() === uniqueId.toLowerCase());
    if (matches.length) return { requisition: exactOne(matches), status: matches.length === 1 ? "resolved" : "ambiguous", matchedBy: "unique-id" };
  }
  const reqNumber = text(candidate.reqNumber || form.reqNumber);
  if (reqNumber) {
    const matches = records(requisitions).filter((req) => text(req.reqNumber).toLowerCase() === reqNumber.toLowerCase());
    if (matches.length) return { requisition: exactOne(matches), status: matches.length === 1 ? "resolved" : "ambiguous", matchedBy: "req-number" };
  }
  return { requisition: null, status: "unmapped", matchedBy: "none" };
}

export function resolveCanonicalFacility({ candidate = {}, requisition = null, sites = [], facilityIndex = null } = {}) {
  const index = facilityIndex || buildFacilityIndex(sites);
  const form = candidate.formSnapshot || {};
  const stableIds = [candidate.facilityId, candidate.siteId, candidate.canonicalFacilityId, form.facilityId, form.siteId, requisition?.facilityId, requisition?.siteId].map(text).filter(Boolean);
  for (const id of stableIds) {
    const facility = index.byId.get(id);
    if (facility) return { facility, status: "resolved", matchedBy: "stable-id", originalLabel: text(candidate.site || form.siteName || requisition?.siteName) };
  }
  const labels = [requisition?.siteName, candidate.site, form.siteName, candidate.facility].map(text).filter(Boolean);
  for (const label of labels) {
    const canonicalMatches = index.byName.get(normalizeFacilityKey(label)) || [];
    if (canonicalMatches.length === 1) return { facility: canonicalMatches[0], status: "resolved", matchedBy: "canonical-name", originalLabel: text(candidate.site || form.siteName || label) };
    if (canonicalMatches.length > 1) return { facility: null, status: "ambiguous", matchedBy: "canonical-name", originalLabel: label, matches: canonicalMatches };
  }
  for (const label of labels) {
    const aliasMatches = index.byAlias.get(normalizeFacilityKey(label)) || [];
    if (aliasMatches.length === 1) return { facility: aliasMatches[0], status: "resolved", matchedBy: "alias", originalLabel: text(candidate.site || form.siteName || label) };
    if (aliasMatches.length > 1) return { facility: null, status: "ambiguous", matchedBy: "alias", originalLabel: label, matches: aliasMatches };
  }
  return { facility: null, status: "unmapped", matchedBy: "none", originalLabel: text(candidate.site || form.siteName || requisition?.siteName) };
}

function candidateRequisitionId(candidate = {}) {
  const form = candidate.formSnapshot || {};
  return text(candidate.requisitionId || candidate.reqId || candidate.selectedRequisitionId || form.selectedRequisitionId || form.requisitionId);
}

function candidateRequisitionNumber(candidate = {}) {
  const form = candidate.formSnapshot || {};
  return text(candidate.reqNumber || form.reqNumber);
}

function issueRecord({ recordType = "", originalFacilityLabel = "", identifier = "", issue = "", recommendedSetupLocation = "" } = {}) {
  return { recordType, originalFacilityLabel, identifier, issue, recommendedSetupLocation };
}

function uniqueIssues(issues = []) {
  const seen = new Set();
  return issues.filter((item) => {
    const key = [item.recordType, item.identifier, item.issue, item.originalFacilityLabel].map(text).join("|");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function dataQualityWorksheetRow(issue = {}) {
  return {
    "Record Type": text(issue.recordType),
    "Original Facility Label": text(issue.originalFacilityLabel),
    "Candidate or Requisition Identifier": text(issue.identifier),
    Issue: text(issue.issue),
    "Recommended Setup Location": text(issue.recommendedSetupLocation),
  };
}

export function buildCanonicalReportingModel({ tracker = [], requisitions = [], sites = [], contacts = [], reporting = {} } = {}) {
  const normalizedReporting = normalizeReportingSettings(reporting);
  const facilityIndex = buildFacilityIndex(sites);
  const regionById = new Map(normalizedReporting.regions.map((region) => [region.id, region]));
  const regionalContacts = activeRegionalContacts(contacts);
  const dataQuality = [];

  [
    ...Array.from(facilityIndex.byName.entries()),
    ...Array.from(facilityIndex.byAlias.entries()),
  ].forEach(([label, matches]) => {
    const facilityIds = Array.from(new Set(matches.map((facility) => facility.id).filter(Boolean)));
    if (facilityIds.length < 2) return;
    dataQuality.push(issueRecord({
      recordType: "Facility",
      originalFacilityLabel: label,
      identifier: facilityIds.join(", "),
      issue: "Ambiguous Facility",
      recommendedSetupLocation: "Facility & Position Setup → Facilities",
    }));
  });

  const requisitionRecords = records(requisitions).map((requisition, index) => {
    const resolution = resolveCanonicalFacility({ requisition, sites, facilityIndex });
    const facility = resolution.facility;
    const requisitionId = text(requisition.id);
    const requisitionNumber = text(requisition.reqNumber);
    const identifier = requisitionId || requisitionNumber || `requisition-row-${index + 1}`;
    if (resolution.status !== "resolved") {
      dataQuality.push(issueRecord({
        recordType: "Requisition",
        originalFacilityLabel: resolution.originalLabel,
        identifier,
        issue: resolution.status === "ambiguous" ? "Ambiguous Facility" : "Unmapped Facility",
        recommendedSetupLocation: "Facility & Position Setup → Facilities",
      }));
    }
    if (!requisitionId) {
      dataQuality.push(issueRecord({
        recordType: "Requisition",
        originalFacilityLabel: resolution.originalLabel,
        identifier,
        issue: "Missing Requisition ID",
        recommendedSetupLocation: "Facility & Position Setup → Positions / Requisitions",
      }));
    }
    if (!text(requisition.uniqueIdNumber)) {
      dataQuality.push(issueRecord({
        recordType: "Requisition",
        originalFacilityLabel: resolution.originalLabel,
        identifier,
        issue: "Missing Unique ID",
        recommendedSetupLocation: "Facility & Position Setup → Positions / Requisitions",
      }));
    }
    return {
      id: identifier,
      requisitionId,
      requisitionNumber,
      uniqueIdNumber: text(requisition.uniqueIdNumber),
      facilityId: facility?.id || "",
      facilityName: facility?.siteName || "Unmapped Facility",
      originalFacilityLabel: resolution.originalLabel,
      regionId: facility?.regionId || "",
      regionName: regionById.get(facility?.regionId)?.name || text(facility?.region),
      position: text(requisition.positionTitle),
      resolutionStatus: resolution.status,
      resolutionMatchedBy: resolution.matchedBy,
      source: requisition,
      reportingItem: {
        ...requisition,
        facilityId: facility?.id || "",
        canonicalFacilityId: facility?.id || "",
        canonicalFacilityName: facility?.siteName || "Unmapped Facility",
        originalFacilityLabel: resolution.originalLabel,
        regionId: facility?.regionId || "",
        regionName: regionById.get(facility?.regionId)?.name || text(facility?.region),
        requisitionId,
        requisitionNumber,
        siteName: facility?.siteName || "Unmapped Facility",
      },
    };
  });

  const requisitionRecordBySource = new Map(requisitionRecords.map((record) => [record.source, record]));
  const candidateRecords = records(tracker).map((candidate, index) => {
    const requisitionResolution = resolveRequisition(candidate, requisitions);
    const requisition = requisitionResolution.requisition;
    const canonicalRequisition = requisition ? requisitionRecordBySource.get(requisition) : null;
    const facilityResolution = resolveCanonicalFacility({ candidate, requisition, sites, facilityIndex });
    const facility = facilityResolution.facility;
    const form = candidate.formSnapshot || {};
    const candidateId = text(candidate.id) || `candidate-row-${index + 1}`;
    const requisitionId = text(requisition?.id) || candidateRequisitionId(candidate);
    const requisitionNumber = text(requisition?.reqNumber) || candidateRequisitionNumber(candidate);
    const facilityName = facility?.siteName || "Unmapped Facility";
    const regionName = regionById.get(facility?.regionId)?.name || text(facility?.region);
    const regionalContactNames = facility
      ? regionalContacts
        .filter((contact) => uniqueText(contact.assignedFacilityIds).includes(facility.id))
        .map((contact) => text(contact.name || contact.title))
        .filter(Boolean)
      : [];

    if (facilityResolution.status !== "resolved") {
      dataQuality.push(issueRecord({
        recordType: "Candidate",
        originalFacilityLabel: facilityResolution.originalLabel,
        identifier: candidateId,
        issue: facilityResolution.status === "ambiguous" ? "Ambiguous Facility" : "Unmapped Facility",
        recommendedSetupLocation: "Facility & Position Setup → Facilities",
      }));
    }
    if (!facility?.id) {
      dataQuality.push(issueRecord({
        recordType: "Candidate",
        originalFacilityLabel: facilityResolution.originalLabel,
        identifier: candidateId,
        issue: "Missing Facility ID",
        recommendedSetupLocation: "Facility & Position Setup → Facilities",
      }));
    }
    if (!requisition || requisitionResolution.status !== "resolved") {
      dataQuality.push(issueRecord({
        recordType: "Candidate",
        originalFacilityLabel: facilityResolution.originalLabel,
        identifier: candidateId,
        issue: requisitionResolution.status === "ambiguous" ? "Ambiguous Requisition" : "Missing Requisition ID",
        recommendedSetupLocation: "Facility & Position Setup → Positions / Requisitions",
      }));
    }

    const reportingItem = {
      ...candidate,
      facilityId: facility?.id || "",
      canonicalFacilityId: facility?.id || "",
      canonicalFacilityName: facilityName,
      originalFacilityLabel: facilityResolution.originalLabel,
      regionId: facility?.regionId || "",
      regionName,
      requisitionId,
      requisitionNumber,
      reqNumber: requisitionNumber,
      uniqueIdNumber: text(requisition?.uniqueIdNumber || candidate.uniqueIdNumber || form.uniqueIdNumber),
      site: facilityName,
      position: text(requisition?.positionTitle || candidate.position || form.position || form.positionTitle),
      reportingResolution: {
        facility: facilityResolution.status,
        facilityMatchedBy: facilityResolution.matchedBy,
        requisition: requisitionResolution.status,
        requisitionMatchedBy: requisitionResolution.matchedBy,
      },
    };

    return {
      id: candidateId,
      candidateId,
      facilityId: facility?.id || "",
      facilityName,
      originalFacilityLabel: facilityResolution.originalLabel,
      regionId: facility?.regionId || "",
      regionName,
      regionalContactNames,
      requisitionId,
      requisitionNumber,
      uniqueIdNumber: reportingItem.uniqueIdNumber,
      position: reportingItem.position,
      facilityResolutionStatus: facilityResolution.status,
      facilityResolutionMatchedBy: facilityResolution.matchedBy,
      requisitionResolutionStatus: requisitionResolution.status,
      requisitionResolutionMatchedBy: requisitionResolution.matchedBy,
      requisitionRecord: canonicalRequisition,
      source: candidate,
      reportingItem,
    };
  });

  regionalContacts.forEach((contact) => {
    const assigned = uniqueText(contact.assignedFacilityIds);
    if (!assigned.length) {
      dataQuality.push(issueRecord({
        recordType: "Regional Contact",
        identifier: text(contact.id || contact.name),
        issue: "Regional contact with no assigned facilities",
        recommendedSetupLocation: "Settings → People & Contacts",
      }));
    }
    assigned.filter((id) => facilityIndex.byId.get(id)?.status === "Inactive").forEach((id) => {
      dataQuality.push(issueRecord({
        recordType: "Regional Contact",
        originalFacilityLabel: facilityIndex.byId.get(id)?.siteName || "",
        identifier: text(contact.id || contact.name),
        issue: "Inactive assigned facility",
        recommendedSetupLocation: "Settings → People & Contacts",
      }));
    });
  });

  return {
    facilities: facilityIndex.facilities.map((facility) => ({
      ...facility,
      facilityId: facility.id,
      facilityName: facility.siteName,
      regionName: regionById.get(facility.regionId)?.name || text(facility.region),
    })),
    requisitions: requisitionRecords,
    candidates: candidateRecords,
    dataQuality: uniqueIssues(dataQuality),
    facilityIndex,
    reporting: normalizedReporting,
  };
}

export function activeRegionalContacts(contacts = []) {
  return records(contacts).filter((contact) => contact.active !== false && text(contact.status || "Active") === "Active" && REGIONAL_CONTACT_ROLES.includes(text(contact.contactRole)));
}

export function selectAllActiveFacilityIds(sites = []) {
  return records(sites).map(normalizeFacilityRecord).filter((site) => site.status === "Active" && site.id).map((site) => site.id);
}

export function selectAllVisibleFacilityIds(sites = [], search = "") {
  const query = normalizeFacilityKey(search);
  return records(sites).map(normalizeFacilityRecord).filter((site) => {
    if (site.status !== "Active" || !site.id) return false;
    if (!query) return true;
    return [site.siteName, site.facilityCode, ...site.aliases].some((value) => normalizeFacilityKey(value).includes(query));
  }).map((site) => site.id);
}

export function clearFacilitySelection() {
  return [];
}

export function resolveReportScope({ scope = "all-active", sites = [], regions = [], contacts = [], selectedFacilityIds = [], selectedRegionIds = [], selectedRegionalContactIds = [] } = {}) {
  const activeSites = records(sites).map(normalizeFacilityRecord).filter((site) => site.status === "Active");
  const activeIds = new Set(activeSites.map((site) => site.id));
  let ids = [];
  if (scope === "all-active") ids = [...activeIds];
  if (scope === "selected-facilities") ids = uniqueText(selectedFacilityIds).filter((id) => activeIds.has(id));
  if (scope === "region") {
    const selected = new Set(uniqueText(selectedRegionIds));
    ids = activeSites.filter((site) => selected.has(site.regionId)).map((site) => site.id);
  }
  if (scope === "regional-contact") {
    const selected = new Set(uniqueText(selectedRegionalContactIds));
    ids = activeRegionalContacts(contacts).filter((contact) => selected.has(text(contact.id))).flatMap((contact) => uniqueText(contact.assignedFacilityIds)).filter((id) => activeIds.has(id));
  }
  ids = Array.from(new Set(ids));
  const errors = [];
  if (!ids.length) errors.push("Select at least one facility, region, or regional contact.");
  const selectedRegions = records(regions).filter((region) => uniqueText(selectedRegionIds).includes(text(region.id)));
  const selectedContacts = activeRegionalContacts(contacts).filter((contact) => uniqueText(selectedRegionalContactIds).includes(text(contact.id)));
  return { facilityIds: ids, facilityCount: ids.length, errors, selectedRegions, selectedContacts };
}

function firstDate(...values) {
  return values.map(text).find(Boolean) || "";
}

function daysAging(dateValue, now = new Date()) {
  const date = new Date(dateValue);
  if (!dateValue || Number.isNaN(date.getTime())) return "";
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86400000));
}

function benefitsLabel(value) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "Unknown";
}

function reportRisk(candidate = {}) {
  const level = text(candidate.riskLevel || candidate.risk || candidate.formSnapshot?.riskLevel);
  if (level) return level;
  const age = daysAging(candidate.submissionDate || candidate.createdAt);
  return Number(age) >= 7 ? "High" : Number(age) >= 4 ? "Medium" : "Low";
}

export function buildWeeklyCleanupReport({ tracker = [], history = [], requisitions = [], sites = [], contacts = [], reporting = {}, scope = {}, selectedColumnIds = DEFAULT_REPORT_COLUMN_IDS, includeTotals = true, workbookLayout = "Summary + Facility Tabs", generatedAt = new Date(), dataThrough = "", generatedBy = "", reportName = "Weekly Cleanup Report", appliedPreset = "Custom", hydrated = true, loadError = "" } = {}) {
  const scopeName = scope.scope || "all-active";
  const selectedColumns = uniqueText(selectedColumnIds).filter((id) => REPORT_COLUMNS.some((column) => column.id === id));
  const errors = [];
  if (!hydrated || loadError) errors.push("WelcomeFlow could not load the current reporting data. Export was paused to prevent an incomplete report.");
  if (!selectedColumns.length) errors.push("Select at least one report column.");
  const canonicalModel = buildCanonicalReportingModel({ tracker, requisitions, sites, contacts, reporting });
  const normalizedReporting = canonicalModel.reporting;
  const resolvedScope = resolveReportScope({ sites, regions: normalizedReporting.regions, contacts, ...scope, scope: scopeName });
  errors.push(...resolvedScope.errors);
  const facilityIndex = canonicalModel.facilityIndex;
  const allowed = new Set(resolvedScope.facilityIds);
  const rows = [];
  const dataQuality = canonicalModel.dataQuality.map(dataQualityWorksheetRow);
  const seenCandidateIds = new Set();

  canonicalModel.candidates.forEach((canonicalRecord) => {
    const candidate = canonicalRecord.source;
    const req = canonicalRecord.requisitionRecord?.source || null;
    const facility = canonicalRecord.facilityId ? facilityIndex.byId.get(canonicalRecord.facilityId) : null;
    const unresolved = canonicalRecord.facilityResolutionStatus !== "resolved";
    if (facility && !allowed.has(facility.id)) return;
    if (unresolved && scopeName !== "all-active") return;
    const candidateId = canonicalRecord.candidateId;
    seenCandidateIds.add(candidateId);
    const form = candidate.formSnapshot || {};
    const submitted = firstDate(candidate.submissionDate, candidate.submittedAt, form.submissionDate);
    const values = {
      candidateName: text(candidate.candidate || candidate.name || form.fullName) || "Unnamed Candidate",
      candidateType: text(candidate.candidateType || form.candidateType),
      candidateSource: text(candidate.candidateSource || candidate.source || form.candidateSource || form.source),
      facility: canonicalRecord.facilityName,
      facilityId: canonicalRecord.facilityId,
      facilityCode: facility?.facilityCode || "",
      originalFacilityLabel: canonicalRecord.originalFacilityLabel,
      region: canonicalRecord.regionName,
      regionalContact: canonicalRecord.regionalContactNames.join("; "),
      position: canonicalRecord.position,
      reqNumber: canonicalRecord.requisitionNumber,
      uniqueIdNumber: canonicalRecord.uniqueIdNumber,
      employmentType: text(req?.employmentType || candidate.employmentType || form.employmentType),
      shift: text(req?.shiftPreference || req?.shift || candidate.shift || form.shiftPreference),
      fte: text(req?.fte || candidate.fte || form.fte),
      weeklyHours: req?.weeklyHours !== null && req?.weeklyHours !== undefined && text(req.weeklyHours) !== "" && Number.isFinite(Number(req.weeklyHours)) ? Number(req.weeklyHours) : "",
      benefitsEligible: benefitsLabel(req?.benefitsEligible),
      candidateStatus: text(candidate.status),
      pipelineStage: text(candidate.pipelineStage || candidate.stage || candidate.reportTag),
      riskLevel: reportRisk(candidate),
      riskReason: text(candidate.riskReason || candidate.attention || candidate.stuckReason),
      nextAction: text(candidate.nextAction || form.nextAction),
      waitingOn: text(candidate.waitingOn || candidate.owner),
      candidateNotes: text(form.candidateNotes || candidate.candidateNotes),
      recruiterNotes: text(candidate.recruiterNotes || candidate.notes || form.recruiterNotes),
      actionHistory: reportingActionHistory(candidate, history),
      submittedDate: submitted,
      daysAging: daysAging(submitted, generatedAt),
      interviewDate: firstDate(candidate.interviewDate, candidate.bookingRecord?.date, form.interviewDate),
      offerStatus: text(candidate.offerStatus || (/offer/i.test(text(candidate.status)) ? candidate.status : "")),
      tentativeStartDate: firstDate(candidate.tentativeStartDate, form.tentativeStartDate),
      confirmedStartDate: firstDate(candidate.confirmedStartDate, candidate.startDate, form.confirmedStartDate),
      recruiterOwner: text(candidate.recruiterOwner || candidate.relationshipOwner || form.recruiterName),
    };
    rows.push({
      id: candidateId,
      candidateId,
      facilityId: canonicalRecord.facilityId,
      facilityName: canonicalRecord.facilityName,
      originalFacilityLabel: canonicalRecord.originalFacilityLabel,
      regionId: canonicalRecord.regionId,
      regionName: canonicalRecord.regionName,
      requisitionId: canonicalRecord.requisitionId,
      requisitionNumber: canonicalRecord.requisitionNumber,
      values,
      resolution: canonicalRecord.facilityResolutionStatus,
      source: candidate,
    });
  });

  const scopedReqs = canonicalModel.requisitions.filter((record) => record.facilityId && allowed.has(record.facilityId) && isLiveReportingRequisition(record.source)).map((record) => record.source);
  const totals = {
    candidateRows: rows.length,
    uniqueCandidates: seenCandidateIds.size,
    selectedFacilities: resolvedScope.facilityCount,
    activeCandidates: rows.filter((row) => !isClosedReportingStatus(row.values.candidateStatus)).length,
    interviews: rows.filter((row) => Boolean(row.values.interviewDate) || /interview/i.test(row.values.candidateStatus)).length,
    offers: rows.filter((row) => Boolean(row.values.offerStatus) || /offer/i.test(row.values.candidateStatus)).length,
    hires: rows.filter((row) => /hired|placed/i.test(row.values.candidateStatus)).length,
    highRisk: rows.filter((row) => row.values.riskLevel === "High").length,
    openings: scopedReqs.reduce((sum, req) => sum + Math.max(0, Number(req.remainingOpenings ?? req.numberOfOpenings ?? req.openings ?? 0) || 0), 0),
    tentativeStarts: rows.filter((row) => Boolean(row.values.tentativeStartDate)).length,
  };
  const columnDefinitions = selectedColumns.map((id) => REPORT_COLUMNS.find((column) => column.id === id)).filter(Boolean);
  const detailRows = rows.map((row) => Object.fromEntries(columnDefinitions.map((column) => [column.label, row.values[column.id] ?? ""])));
  const metadata = {
    "Report Name": reportName,
    "Generated At": generatedAt.toISOString(),
    "Data Through": dataThrough || generatedAt.toISOString(),
    "Generated By": generatedBy || "Not available",
    "Report Scope": REPORT_SCOPE_OPTIONS.find((option) => option.id === scopeName)?.label || "All Active Facilities",
    "Selected Facility Count": resolvedScope.facilityCount,
    "Selected Region or Regional Contact": [...resolvedScope.selectedRegions.map((region) => region.name), ...resolvedScope.selectedContacts.map((contact) => contact.name || contact.title)].filter(Boolean).join("; ") || "None",
    "Applied Preset": appliedPreset,
    "Current Facility Data Version": normalizedReporting.facilityDataUpdatedAt || "Current hydrated workspace",
  };
  const expectedTabs = workbookTabsFor({ workbookLayout, rows, sites: facilityIndex.facilities, regions: normalizedReporting.regions, dataQuality });
  return { canExport: errors.length === 0, errors, rows, detailRows, dataQuality, totals, metadata, selectedColumns: columnDefinitions, resolvedScope, includeTotals, workbookLayout, expectedTabs, canonicalModel };
}

function workbookTabsFor({ workbookLayout, rows, sites, regions }) {
  const tabs = [];
  if (workbookLayout !== "Single Detail Sheet") tabs.push("Summary");
  tabs.push("Detail");
  if (workbookLayout === "Summary + Facility Tabs") {
    const ids = new Set(rows.map((row) => row.facilityId).filter(Boolean));
    sites.filter((site) => ids.has(site.id)).forEach((site) => tabs.push(site.siteName));
  }
  if (workbookLayout === "Summary + Regional Tabs") {
    const ids = new Set(rows.map((row) => row.regionId).filter(Boolean));
    regions.filter((region) => ids.has(region.id)).forEach((region) => tabs.push(region.name));
  }
  tabs.push("Data Quality");
  return tabs;
}

function detailSheet(name, report, rows) {
  const columns = report.selectedColumns.map((column) => column.label);
  const safeRows = rows.map((row) => Object.fromEntries(report.selectedColumns.map((column) => [column.label, row.values[column.id] ?? ""])));
  const dataStartRow = 2;
  const dataEndRow = Math.max(dataStartRow, dataStartRow + safeRows.length - 1);
  return {
    name,
    columns,
    rows: safeRows,
    totals: report.includeTotals ? { label: "Total candidate rows", value: safeRows.length, formula: `=SUBTOTAL(103,R${dataStartRow}C1:R${dataEndRow}C1)` } : null,
    autoFilter: true,
  };
}

export function buildWeeklyCleanupWorkbook(report, { sites = [], regions = [] } = {}) {
  if (!report?.canExport) return [];
  const sheets = [];
  if (report.workbookLayout !== "Single Detail Sheet") {
    sheets.push({ name: "Summary", columns: ["Metric", "Value"], rows: [
      ...Object.entries(report.metadata).map(([Metric, Value]) => ({ Metric, Value })),
      { Metric: "Total candidate rows", Value: report.totals.candidateRows },
      { Metric: "Unique candidates", Value: report.totals.uniqueCandidates },
      { Metric: "Total selected facilities", Value: report.totals.selectedFacilities },
      { Metric: "Total active candidates", Value: report.totals.activeCandidates },
      { Metric: "Total interviews", Value: report.totals.interviews },
      { Metric: "Total offers", Value: report.totals.offers },
      { Metric: "Total hires", Value: report.totals.hires },
      { Metric: "Total high-risk candidates", Value: report.totals.highRisk },
      { Metric: "Total openings", Value: report.totals.openings },
      { Metric: "Total tentative starts", Value: report.totals.tentativeStarts },
    ] });
  }
  sheets.push(detailSheet("Detail", report, report.rows));
  if (report.workbookLayout === "Summary + Facility Tabs") {
    const byId = new Map(records(sites).map((site) => [text(site.id), site]));
    Array.from(new Set(report.rows.map((row) => row.facilityId).filter(Boolean))).forEach((id) => sheets.push(detailSheet(byId.get(id)?.siteName || id, report, report.rows.filter((row) => row.facilityId === id))));
  }
  if (report.workbookLayout === "Summary + Regional Tabs") {
    const byId = new Map(records(regions).map((region) => [text(region.id), region]));
    Array.from(new Set(report.rows.map((row) => row.regionId).filter(Boolean))).forEach((id) => sheets.push(detailSheet(byId.get(id)?.name || id, report, report.rows.filter((row) => row.regionId === id))));
  }
  sheets.push({ name: "Data Quality", columns: ["Record Type", "Original Facility Label", "Candidate or Requisition Identifier", "Issue", "Recommended Setup Location"], rows: report.dataQuality });
  return sheets;
}

export function reorderSelectedColumn(columnIds = [], columnId = "", direction = "up") {
  const next = [...columnIds];
  const index = next.indexOf(columnId);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
