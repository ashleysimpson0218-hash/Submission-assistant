import fs from "fs";
import path from "path";
import {
  DEFAULT_REPORT_COLUMN_IDS,
  REPORT_COLUMNS,
  activeRegionalContacts,
  applyCanonicalFacilityUpdate,
  buildCanonicalReportingModel,
  buildFacilityIndex,
  buildWeeklyCleanupReport,
  buildWeeklyCleanupWorkbook,
  clearFacilitySelection,
  createDefaultReportPresets,
  normalizePreset,
  normalizeReportingSettings,
  reorderSelectedColumn,
  resolveCanonicalFacility,
  resolveReportScope,
  selectAllActiveFacilityIds,
  selectAllVisibleFacilityIds,
} from "./weeklyCleanupReporting";

const sites = [
  { id: "facility-burruss", siteName: "Burruss Training Center", facilityCode: "BTC", aliases: ["Burruss CTC", "Burruss TC"], regionId: "region-south", status: "Active" },
  { id: "facility-metro", siteName: "Metro Reentry", aliases: [], regionId: "region-south", status: "Active" },
  { id: "facility-north", siteName: "North Center", aliases: ["Shared Alias"], regionId: "region-north", status: "Active" },
  { id: "facility-east", siteName: "East Center", aliases: ["Shared Alias"], regionId: "region-north", status: "Active" },
  { id: "facility-inactive", siteName: "Closed Center", aliases: [], regionId: "region-north", status: "Inactive" },
];

const requisitions = [
  { id: "req-1", facilityId: "facility-burruss", siteName: "Burruss CTC", positionTitle: "Registered Nurse", reqNumber: "1001", uniqueIdNumber: "U-1001", employmentType: "Full-time", benefitsEligible: false, weeklyHours: 36, fte: "0.9", shiftPreference: "Day", numberOfOpenings: 2, status: "Active" },
  { id: "req-2", facilityId: "facility-metro", siteName: "Metro Reentry", positionTitle: "LPN", reqNumber: "1002", uniqueIdNumber: "U-1002", employmentType: "PRN", benefitsEligible: true, workSchedule: "As Needed", numberOfOpenings: 1, status: "Active" },
];

const tracker = [
  { id: "candidate-1", candidate: "Synthetic Candidate One", candidateType: "External", requisitionId: "req-1", site: "Burruss CTC", position: "Old Position Label", reqNumber: "1001", status: "Submitted", pipelineStage: "Submit", nextAction: "Awaiting facility feedback", waitingOn: "Facility", submissionDate: "2026-07-14", riskLevel: "Low", formSnapshot: { candidateNotes: "Synthetic note" } },
  { id: "candidate-2", candidate: "Synthetic Candidate Two", candidateType: "Internal", requisitionId: "req-2", site: "Metro Reentry", status: "Interview Scheduled", interviewDate: "2026-07-23", nextAction: "Prepare interview", submissionDate: "2026-07-15", riskLevel: "High", tentativeStartDate: "2026-08-01" },
];

const reporting = { regions: [{ id: "region-south", name: "South", active: true }, { id: "region-north", name: "North", active: true }], reportPresets: createDefaultReportPresets(), facilityDataUpdatedAt: "2026-07-21T12:00:00.000Z" };
const contacts = [
  { id: "contact-director", name: "Synthetic Regional Director", contactRole: "Regional Director", regionId: "region-south", assignedFacilityIds: ["facility-burruss", "facility-metro"], status: "Active", active: true },
  { id: "contact-manager", name: "Synthetic Regional Manager", contactRole: "Regional Manager", regionId: "region-south", assignedFacilityIds: ["facility-burruss"], status: "Active", active: true },
];

function report(overrides = {}) {
  return buildWeeklyCleanupReport({ tracker, requisitions, sites, contacts, reporting, scope: { scope: "all-active" }, selectedColumnIds: DEFAULT_REPORT_COLUMN_IDS, includeTotals: true, workbookLayout: "Summary + Facility Tabs", generatedAt: new Date("2026-07-21T12:00:00.000Z"), hydrated: true, ...overrides });
}

describe("configurable Weekly Cleanup reporting", () => {
  test("canonical reporting records expose stable facility and requisition identity without mutating source data", () => {
    const trackerBefore = JSON.parse(JSON.stringify(tracker));
    const requisitionsBefore = JSON.parse(JSON.stringify(requisitions));
    const sitesBefore = JSON.parse(JSON.stringify(sites));
    const model = buildCanonicalReportingModel({ tracker, requisitions, sites, contacts, reporting });
    const record = model.candidates.find((candidate) => candidate.candidateId === "candidate-1");

    expect(record).toMatchObject({
      facilityId: "facility-burruss",
      facilityName: "Burruss Training Center",
      originalFacilityLabel: "Burruss CTC",
      regionId: "region-south",
      regionName: "South",
      requisitionId: "req-1",
      requisitionNumber: "1001",
      uniqueIdNumber: "U-1001",
      position: "Registered Nurse",
      facilityResolutionStatus: "resolved",
      requisitionResolutionStatus: "resolved",
    });
    expect(record.reportingItem).toMatchObject({
      facilityId: "facility-burruss",
      canonicalFacilityName: "Burruss Training Center",
      originalFacilityLabel: "Burruss CTC",
      requisitionId: "req-1",
      requisitionNumber: "1001",
      site: "Burruss Training Center",
      position: "Registered Nurse",
    });
    expect(tracker).toEqual(trackerBefore);
    expect(requisitions).toEqual(requisitionsBefore);
    expect(sites).toEqual(sitesBefore);
  });

  test("canonical reporting records collapse aliases to one facility identity", () => {
    const model = buildCanonicalReportingModel({
      tracker: [
        { ...tracker[0], id: "candidate-alias", site: "Burruss CTC" },
        { ...tracker[0], id: "candidate-canonical", site: "Burruss Training Center" },
      ],
      requisitions,
      sites,
      contacts,
      reporting,
    });

    expect(model.candidates.map((record) => record.facilityId)).toEqual(["facility-burruss", "facility-burruss"]);
    expect(model.candidates.map((record) => record.facilityName)).toEqual(["Burruss Training Center", "Burruss Training Center"]);
    expect(model.facilities.filter((facility) => facility.facilityId === "facility-burruss")).toHaveLength(1);
  });

  test("ambiguous aliases remain unresolved and blocking in the canonical model", () => {
    const model = buildCanonicalReportingModel({
      tracker: [{ id: "candidate-ambiguous", candidate: "Synthetic Ambiguous", site: "Shared Alias", status: "Submitted" }],
      requisitions: [],
      sites,
      contacts,
      reporting,
    });
    const record = model.candidates[0];

    expect(record.facilityId).toBe("");
    expect(record.facilityName).toBe("Unmapped Facility");
    expect(record.originalFacilityLabel).toBe("Shared Alias");
    expect(record.facilityResolutionStatus).toBe("ambiguous");
    expect(model.dataQuality).toEqual(expect.arrayContaining([
      expect.objectContaining({ recordType: "Candidate", identifier: "candidate-ambiguous", issue: "Ambiguous Facility" }),
      expect.objectContaining({ recordType: "Candidate", identifier: "candidate-ambiguous", issue: "Missing Facility ID" }),
    ]));
  });

  test("facility master-data alias collisions are surfaced instead of merged", () => {
    const model = buildCanonicalReportingModel({ tracker: [], requisitions: [], sites, contacts, reporting });

    expect(model.dataQuality).toEqual(expect.arrayContaining([
      expect.objectContaining({
        recordType: "Facility",
        identifier: "facility-north, facility-east",
        issue: "Ambiguous Facility",
      }),
    ]));
    expect(model.facilities.filter((facility) => ["facility-north", "facility-east"].includes(facility.facilityId))).toHaveLength(2);
  });

  test("duplicate facility source rows with one stable ID produce one canonical facility", () => {
    const model = buildCanonicalReportingModel({
      tracker,
      requisitions,
      sites: [...sites, { ...sites[0], siteName: "Legacy Duplicate Label" }],
      contacts,
      reporting,
    });

    expect(model.facilities.filter((facility) => facility.facilityId === "facility-burruss")).toHaveLength(1);
  });

  test("default scope behaves as All Active Facilities and preserves unmapped rows", () => {
    const result = buildWeeklyCleanupReport({ tracker: [...tracker, { id: "candidate-unmapped", candidate: "Unmapped", site: "Unknown Facility" }], requisitions, sites, contacts, reporting, selectedColumnIds: ["candidateName", "facility"], generatedAt: new Date("2026-07-21T12:00:00.000Z") });
    expect(result.metadata["Report Scope"]).toBe("All Active Facilities");
    expect(result.rows.some((row) => row.id === "candidate-unmapped")).toBe(true);
  });

  test("blank weekly hours remain blank rather than becoming zero", () => {
    const result = report({ requisitions: [{ ...requisitions[0], weeklyHours: null }, requisitions[1]], selectedColumnIds: ["weeklyHours"] });
    expect(result.rows.find((row) => row.id === "candidate-1").values.weeklyHours).toBe("");
  });

  test.each(["riskLevel", "candidateStatus", "candidateNotes"])("a recruiter can exclude %s from Excel", (columnId) => {
    const selected = REPORT_COLUMNS.map((column) => column.id).filter((id) => id !== columnId);
    const workbook = buildWeeklyCleanupWorkbook(report({ selectedColumnIds: selected }), { sites, regions: reporting.regions });
    expect(workbook.find((sheet) => sheet.name === "Detail").columns).not.toContain(REPORT_COLUMNS.find((column) => column.id === columnId).label);
  });

  test("selected columns appear in the selected order without silently added fields", () => {
    const selectedColumnIds = ["facilityId", "candidateName", "uniqueIdNumber"];
    const workbook = buildWeeklyCleanupWorkbook(report({ selectedColumnIds }), { sites, regions: reporting.regions });
    expect(workbook.find((sheet) => sheet.name === "Detail").columns).toEqual(["Facility ID", "Candidate Name", "Requisition Unique ID"]);
  });

  test("at least one selected column is required", () => {
    const result = report({ selectedColumnIds: [] });
    expect(result.canExport).toBe(false);
    expect(result.errors).toContain("Select at least one report column.");
  });

  test("Select All Active Facilities excludes inactive facilities", () => {
    expect(selectAllActiveFacilityIds(sites)).toEqual(["facility-burruss", "facility-metro", "facility-north", "facility-east"]);
  });

  test("Select All Visible Facilities applies only to the search result", () => {
    expect(selectAllVisibleFacilityIds(sites, "Burruss")).toEqual(["facility-burruss"]);
    expect(selectAllVisibleFacilityIds(sites, "BTC")).toEqual(["facility-burruss"]);
  });

  test("Clear All removes every selected facility", () => {
    expect(clearFacilitySelection(["facility-burruss"])).toEqual([]);
  });

  test("Facility ID and Requisition Unique ID are available", () => {
    const first = report({ selectedColumnIds: ["facilityId", "uniqueIdNumber"] }).detailRows[0];
    expect(first).toEqual({ "Facility ID": "facility-burruss", "Requisition Unique ID": "U-1001" });
  });

  test("Burruss CTC resolves to the canonical Burruss Training Center ID", () => {
    const resolved = resolveCanonicalFacility({ candidate: tracker[0], requisition: requisitions[0], sites });
    expect(resolved.facility.id).toBe("facility-burruss");
    expect(resolved.facility.siteName).toBe("Burruss Training Center");
  });

  test("alias records do not create duplicate facility tabs or totals", () => {
    const result = report({ tracker: [...tracker, { ...tracker[0], id: "candidate-3", site: "Burruss Training Center" }] });
    const workbook = buildWeeklyCleanupWorkbook(result, { sites, regions: reporting.regions });
    expect(workbook.filter((sheet) => sheet.name === "Burruss Training Center")).toHaveLength(1);
    expect(result.rows.filter((row) => row.facilityId === "facility-burruss")).toHaveLength(2);
  });

  test("a facility rename preserves the stable ID and old name as an alias", () => {
    const renamed = applyCanonicalFacilityUpdate(sites[0], { siteName: "Burruss Learning Center" });
    expect(renamed.id).toBe("facility-burruss");
    expect(renamed.aliases).toContain("Burruss Training Center");
  });

  test("the next report displays the current canonical name after a rename", () => {
    const renamedSites = sites.map((site) => site.id === "facility-burruss" ? applyCanonicalFacilityUpdate(site, { siteName: "Burruss Learning Center" }) : site);
    expect(report({ sites: renamedSites }).rows[0].values.facility).toBe("Burruss Learning Center");
  });

  test("ambiguous aliases are flagged and are never guessed", () => {
    const result = report({ tracker: [{ id: "candidate-x", candidate: "Synthetic Ambiguous", site: "Shared Alias", status: "Submitted" }], requisitions: [] });
    expect(result.rows[0].values.facility).toBe("Unmapped Facility");
    expect(result.dataQuality.some((issue) => issue.Issue === "Ambiguous Facility")).toBe(true);
  });

  test("unmapped facilities remain represented and appear in Data Quality", () => {
    const result = report({ tracker: [{ id: "candidate-x", candidate: "Synthetic Unmapped", site: "Unknown Facility", status: "Submitted" }], requisitions: [] });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].values.facility).toBe("Unmapped Facility");
    expect(result.dataQuality.some((issue) => issue.Issue === "Unmapped Facility")).toBe(true);
  });

  test("a regional contact can be assigned multiple stable facility IDs", () => {
    expect(activeRegionalContacts(contacts)[0].assignedFacilityIds).toEqual(["facility-burruss", "facility-metro"]);
  });

  test("a facility can have multiple regional contacts", () => {
    expect(report().rows[0].values.regionalContact).toContain("Synthetic Regional Director");
    expect(report().rows[0].values.regionalContact).toContain("Synthetic Regional Manager");
  });

  test("regional contact scope includes only assigned facilities", () => {
    const result = report({ scope: { scope: "regional-contact", selectedRegionalContactIds: ["contact-manager"] } });
    expect(result.resolvedScope.facilityIds).toEqual(["facility-burruss"]);
    expect(result.rows.map((row) => row.facilityId)).toEqual(["facility-burruss"]);
  });

  test("multiple regional contacts deduplicate shared facilities", () => {
    const scope = resolveReportScope({ scope: "regional-contact", sites, contacts, selectedRegionalContactIds: ["contact-director", "contact-manager"] });
    expect(scope.facilityIds).toEqual(["facility-burruss", "facility-metro"]);
  });

  test("regional assignments are IDs rather than names", () => {
    expect(contacts.flatMap((contact) => contact.assignedFacilityIds).every((id) => id.startsWith("facility-"))).toBe(true);
  });

  test("updating an assignment changes the next generated report", () => {
    const updated = contacts.map((contact) => contact.id === "contact-manager" ? { ...contact, assignedFacilityIds: ["facility-metro"] } : contact);
    const result = report({ contacts: updated, scope: { scope: "regional-contact", selectedRegionalContactIds: ["contact-manager"] } });
    expect(result.rows.map((row) => row.facilityId)).toEqual(["facility-metro"]);
  });

  test("totals are correct and aliases do not double-count facilities", () => {
    const result = report();
    expect(result.totals).toMatchObject({ candidateRows: 2, uniqueCandidates: 2, selectedFacilities: 4, interviews: 1, highRisk: 1, openings: 3, tentativeStarts: 1 });
  });

  test("detail sheets include a filter-aware SUBTOTAL formula", () => {
    const workbook = buildWeeklyCleanupWorkbook(report(), { sites, regions: reporting.regions });
    expect(workbook.find((sheet) => sheet.name === "Detail").totals.formula).toBe("=SUBTOTAL(103,R2C1:R3C1)");
  });

  test("report metadata includes Generated At and Data Through", () => {
    expect(report().metadata).toMatchObject({ "Generated At": "2026-07-21T12:00:00.000Z", "Data Through": "2026-07-21T12:00:00.000Z" });
  });

  test("current requisition and facility master data override stale candidate strings", () => {
    const values = report().rows[0].values;
    expect(values.position).toBe("Registered Nurse");
    expect(values.facility).toBe("Burruss Training Center");
  });

  test("Original Facility Label remains an optional column", () => {
    const result = report({ selectedColumnIds: ["originalFacilityLabel"] });
    expect(result.detailRows[0]["Original Facility Label"]).toBe("Burruss CTC");
  });

  test("Data Quality includes missing IDs and ambiguous records", () => {
    const result = report({ tracker: [{ id: "candidate-x", candidate: "Synthetic", site: "Shared Alias", status: "Submitted" }], requisitions: [] });
    expect(result.dataQuality.map((issue) => issue.Issue)).toEqual(expect.arrayContaining(["Ambiguous Facility", "Missing Facility ID", "Missing Requisition ID"]));
  });

  test.each([[false, ""], [true, "cloud load failed"]])("report generation is blocked when hydration/current loading fails", (hydrated, loadError) => {
    const result = report({ hydrated, loadError });
    expect(result.canExport).toBe(false);
    expect(result.errors.join(" ")).toMatch(/could not load the current reporting data/i);
  });

  test("facility index keeps canonical and alias lookup separate", () => {
    const index = buildFacilityIndex(sites);
    expect(index.byName.get("burruss training center")[0].id).toBe("facility-burruss");
    expect(index.byAlias.get("burruss ctc")[0].id).toBe("facility-burruss");
  });

  test("named presets persist selected columns, order, scope, totals, and layout", () => {
    const preset = normalizePreset({ id: "custom", name: "Custom", selectedColumns: ["facility", "candidateName"], columnOrder: ["candidateName", "facility"], facilityScope: "selected-facilities", selectedFacilityIds: ["facility-burruss"], includeTotals: false, workbookLayout: "Single Detail Sheet" });
    expect(preset).toMatchObject({ columnOrder: ["candidateName", "facility"], facilityScope: "selected-facilities", selectedFacilityIds: ["facility-burruss"], includeTotals: false, workbookLayout: "Single Detail Sheet" });
  });

  test("default presets include Weekly Cleanup, Full Detail, Leadership, and Regional", () => {
    expect(createDefaultReportPresets().map((preset) => preset.name)).toEqual(["Weekly Cleanup Default", "Full Candidate Detail", "Leadership Summary", "Regional Summary"]);
  });

  test("missing settings are normalized without deleting saved custom presets", () => {
    const normalized = normalizeReportingSettings({ reportPresets: [{ id: "custom", name: "Custom", selectedColumns: ["candidateName"], columnOrder: ["candidateName"] }] });
    expect(normalized.reportPresets.some((preset) => preset.id === "custom")).toBe(true);
    expect(normalized.reportPresets.some((preset) => preset.id === "weekly-cleanup-default")).toBe(true);
  });

  test("column Move Up and Move Down retain a deterministic order", () => {
    expect(reorderSelectedColumn(["candidateName", "facility", "position"], "facility", "up")).toEqual(["facility", "candidateName", "position"]);
    expect(reorderSelectedColumn(["candidateName", "facility", "position"], "facility", "down")).toEqual(["candidateName", "position", "facility"]);
  });

  test("regional layout creates only current regional tabs", () => {
    const result = report({ workbookLayout: "Summary + Regional Tabs" });
    const workbook = buildWeeklyCleanupWorkbook(result, { sites, regions: reporting.regions });
    expect(workbook.map((sheet) => sheet.name)).toEqual(expect.arrayContaining(["Summary", "Detail", "South"]));
    expect(workbook.map((sheet) => sheet.name)).not.toContain("North");
  });

  test("the reporting engine has no Supabase, API, or communication side effects", () => {
    const source = fs.readFileSync(path.join(__dirname, "weeklyCleanupReporting.js"), "utf8");
    expect(source).not.toMatch(/supabase|fetch\(|axios|mailto|clipboard|Mark Candidate Ready|buildOutput|generateOutput/i);
  });
});
