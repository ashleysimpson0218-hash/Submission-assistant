import React, { useMemo, useState } from "react";
import {
  DEFAULT_REPORT_COLUMN_IDS,
  REGIONAL_CONTACT_ROLES,
  REPORT_COLUMNS,
  REPORT_SCOPE_OPTIONS,
  WORKBOOK_LAYOUT_OPTIONS,
  buildWeeklyCleanupReport,
  buildWeeklyCleanupWorkbook,
  createDefaultReportPresets,
  normalizeReportingSettings,
  reorderSelectedColumn,
} from "./weeklyCleanupReporting";

const colors = {
  text: "#24144f",
  muted: "#756a94",
  border: "#ded3ff",
  panel: "#ffffff",
  alt: "#faf8ff",
  purple: "#6d28d9",
  purpleLight: "#f3eefe",
  red: "#b42318",
};

const safeRecords = (value) => Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
const selectedSet = (value) => new Set(Array.isArray(value) ? value : []);

function ActionButton({ children, primary = false, disabled = false, onClick, type = "button" }) {
  return <button type={type} disabled={disabled} onClick={onClick} style={{ border: `1px solid ${primary ? colors.purple : colors.border}`, background: primary ? colors.purple : colors.panel, color: primary ? "#fff" : colors.text, borderRadius: 6, padding: "9px 12px", fontWeight: 900, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1 }}>{children}</button>;
}

function FieldLabel({ children }) {
  return <span style={{ display: "block", color: colors.text, fontWeight: 900, fontSize: 12, marginBottom: 6 }}>{children}</span>;
}

function Checklist({ items, selectedIds, onToggle, emptyText }) {
  const chosen = selectedSet(selectedIds);
  return <div style={{ display: "grid", gap: 6, maxHeight: 220, overflowY: "auto", border: `1px solid ${colors.border}`, borderRadius: 6, padding: 8, background: colors.panel }}>
    {items.length ? items.map((item) => <label key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: 6, borderRadius: 5, background: chosen.has(item.id) ? colors.purpleLight : "transparent", cursor: "pointer" }}>
      <input type="checkbox" checked={chosen.has(item.id)} onChange={(event) => onToggle(item.id, event.target.checked)} />
      <span><strong style={{ color: colors.text }}>{item.label}</strong>{item.helper ? <span style={{ display: "block", color: colors.muted, fontSize: 11, marginTop: 2 }}>{item.helper}</span> : null}</span>
    </label>) : <span style={{ color: colors.muted, padding: 8 }}>{emptyText}</span>}
  </div>;
}

export default function WeeklyCleanupReportBuilder({ settings = {}, setSettings = () => {}, tracker = [], hasLoaded = false, loadError = "", reportStartDate = "", reportEndDate = "", generatedBy = "", downloadExcelWorkbook = () => {} }) {
  const reporting = useMemo(() => normalizeReportingSettings(settings.reporting), [settings.reporting]);
  const presets = reporting.reportPresets.length ? reporting.reportPresets : createDefaultReportPresets();
  const initialPreset = presets[0];
  const [presetId, setPresetId] = useState(initialPreset?.id || "weekly-cleanup-default");
  const [presetName, setPresetName] = useState("Custom");
  const [scope, setScope] = useState(initialPreset?.facilityScope || "all-active");
  const [facilitySearch, setFacilitySearch] = useState("");
  const [selectedFacilityIds, setSelectedFacilityIds] = useState(initialPreset?.selectedFacilityIds || []);
  const [selectedRegionIds, setSelectedRegionIds] = useState(initialPreset?.selectedRegionIds || []);
  const [selectedRegionalContactIds, setSelectedRegionalContactIds] = useState(initialPreset?.selectedRegionalContactIds || []);
  const [selectedColumnIds, setSelectedColumnIds] = useState(initialPreset?.columnOrder || DEFAULT_REPORT_COLUMN_IDS);
  const [includeTotals, setIncludeTotals] = useState(initialPreset?.includeTotals !== false);
  const [workbookLayout, setWorkbookLayout] = useState(initialPreset?.workbookLayout || "Summary + Facility Tabs");
  const [preview, setPreview] = useState(null);
  const [message, setMessage] = useState("");

  const activeFacilities = useMemo(() => safeRecords(settings.sites).filter((site) => String(site.status || "Active") === "Active" && site.id).sort((a, b) => String(a.siteName || "").localeCompare(String(b.siteName || ""))), [settings.sites]);
  const visibleFacilities = useMemo(() => {
    const query = facilitySearch.trim().toLowerCase();
    if (!query) return activeFacilities;
    return activeFacilities.filter((site) => [site.siteName, site.facilityCode, ...(Array.isArray(site.aliases) ? site.aliases : [])].join(" ").toLowerCase().includes(query));
  }, [activeFacilities, facilitySearch]);
  const regionalContacts = useMemo(() => safeRecords(settings.contacts).filter((contact) => contact.status !== "Inactive" && contact.active !== false && REGIONAL_CONTACT_ROLES.includes(contact.contactRole)), [settings.contacts]);

  function toggle(setter, current, id, checked) {
    setter(checked ? Array.from(new Set([...current, id])) : current.filter((item) => item !== id));
    setPreview(null);
  }

  function applyPreset(id) {
    const preset = presets.find((item) => item.id === id);
    setPresetId(id);
    if (!preset) return;
    setScope(preset.facilityScope);
    setSelectedFacilityIds(preset.selectedFacilityIds || []);
    setSelectedRegionIds(preset.selectedRegionIds || []);
    setSelectedRegionalContactIds(preset.selectedRegionalContactIds || []);
    setSelectedColumnIds(preset.columnOrder || preset.selectedColumns || DEFAULT_REPORT_COLUMN_IDS);
    setIncludeTotals(preset.includeTotals !== false);
    setWorkbookLayout(preset.workbookLayout || "Summary + Facility Tabs");
    setPreview(null);
    setMessage(`${preset.name} applied.`);
  }

  function savePreset() {
    const name = presetName.trim();
    if (!name) {
      setMessage("Enter a preset name before saving.");
      return;
    }
    const id = `custom-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || Date.now()}`;
    const nextPreset = { id, name, selectedColumns: [...selectedColumnIds], columnOrder: [...selectedColumnIds], facilityScope: scope, selectedFacilityIds: [...selectedFacilityIds], selectedRegionIds: [...selectedRegionIds], selectedRegionalContactIds: [...selectedRegionalContactIds], includeTotals, workbookLayout, system: false };
    setSettings((previous) => {
      const currentReporting = normalizeReportingSettings(previous.reporting);
      const without = currentReporting.reportPresets.filter((item) => item.id !== id);
      return { ...previous, reporting: { ...currentReporting, reportPresets: [...without, nextPreset] } };
    });
    setPresetId(id);
    setMessage(`${name} saved to workspace settings.`);
  }

  function currentReport() {
    return buildWeeklyCleanupReport({
      tracker,
      requisitions: settings.requisitions,
      sites: settings.sites,
      contacts: settings.contacts,
      reporting,
      scope: { scope, selectedFacilityIds, selectedRegionIds, selectedRegionalContactIds },
      selectedColumnIds,
      includeTotals,
      workbookLayout,
      generatedAt: new Date(),
      dataThrough: reportEndDate || new Date().toISOString(),
      generatedBy,
      appliedPreset: presets.find((item) => item.id === presetId)?.name || presetName || "Custom",
      hydrated: hasLoaded,
      loadError,
    });
  }

  function previewReport() {
    const next = currentReport();
    setPreview(next);
    setMessage(next.canExport ? "Report preview refreshed from the current workspace." : next.errors.join(" "));
  }

  function exportReport() {
    const next = currentReport();
    setPreview(next);
    if (!next.canExport) {
      setMessage(next.errors.join(" "));
      return;
    }
    const sheets = buildWeeklyCleanupWorkbook(next, { sites: settings.sites, regions: reporting.regions });
    downloadExcelWorkbook(`welcomeflow-weekly-cleanup-${reportStartDate || new Date().toISOString().slice(0, 10)}.xls`, sheets);
    setMessage("Weekly Cleanup Excel workbook downloaded locally.");
  }

  const scopeError = preview?.errors?.find((error) => /facility, region, or regional contact/i.test(error));
  const selectedLabels = REPORT_COLUMNS.filter((column) => selectedColumnIds.includes(column.id)).sort((a, b) => selectedColumnIds.indexOf(a.id) - selectedColumnIds.indexOf(b.id));

  return <section aria-label="Weekly Cleanup Report" style={{ display: "grid", gap: 14, border: `1px solid ${colors.border}`, borderRadius: 8, background: colors.panel, padding: 16 }}>
    <div>
      <h2 style={{ margin: 0, color: colors.text, fontSize: 19 }}>Weekly Cleanup Report</h2>
      <p style={{ margin: "5px 0 0", color: colors.muted, lineHeight: 1.5 }}>Configure scope, current master-data resolution, columns, totals, and workbook layout before downloading Excel.</p>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 }}>
      <label><FieldLabel>Report Preset</FieldLabel><select value={presetId} onChange={(event) => applyPreset(event.target.value)} style={{ width: "100%", padding: 9, border: `1px solid ${colors.border}`, borderRadius: 6 }}>{presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</select></label>
      <label><FieldLabel>Report Scope</FieldLabel><select value={scope} onChange={(event) => { setScope(event.target.value); setPreview(null); }} style={{ width: "100%", padding: 9, border: `1px solid ${colors.border}`, borderRadius: 6 }}>{REPORT_SCOPE_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
      <label><FieldLabel>Workbook Layout</FieldLabel><select value={workbookLayout} onChange={(event) => { setWorkbookLayout(event.target.value); setPreview(null); }} style={{ width: "100%", padding: 9, border: `1px solid ${colors.border}`, borderRadius: 6 }}>{WORKBOOK_LAYOUT_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></label>
      <label style={{ display: "flex", alignItems: "end", gap: 8, paddingBottom: 8 }}><input type="checkbox" checked={includeTotals} onChange={(event) => { setIncludeTotals(event.target.checked); setPreview(null); }} /><strong style={{ color: colors.text }}>Include Totals</strong></label>
    </div>

    {scope === "selected-facilities" ? <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}><label style={{ minWidth: 220, flex: 1 }}><FieldLabel>Search Facilities</FieldLabel><input value={facilitySearch} onChange={(event) => setFacilitySearch(event.target.value)} placeholder="Search canonical name, code, or alias" style={{ width: "100%", boxSizing: "border-box", padding: 9, border: `1px solid ${colors.border}`, borderRadius: 6 }} /></label><ActionButton onClick={() => { setSelectedFacilityIds(activeFacilities.map((site) => site.id)); setPreview(null); }}>Select All Active Facilities</ActionButton><ActionButton onClick={() => { setSelectedFacilityIds(Array.from(new Set([...selectedFacilityIds, ...visibleFacilities.map((site) => site.id)]))); setPreview(null); }}>Select All Visible Facilities</ActionButton><ActionButton onClick={() => { setSelectedFacilityIds([]); setPreview(null); }}>Clear All</ActionButton></div>
      <strong style={{ color: colors.text }}>Selected Facility Count: {selectedFacilityIds.length}</strong>
      <Checklist items={visibleFacilities.map((site) => ({ id: site.id, label: site.siteName || "Unnamed Facility", helper: [site.facilityCode, (site.aliases || []).join(", ")].filter(Boolean).join(" | ") }))} selectedIds={selectedFacilityIds} onToggle={(id, checked) => toggle(setSelectedFacilityIds, selectedFacilityIds, id, checked)} emptyText="No active facilities match the search." />
    </div> : null}

    {scope === "region" ? <div><FieldLabel>Regions</FieldLabel><Checklist items={reporting.regions.filter((region) => region.active !== false).map((region) => ({ id: region.id, label: region.name }))} selectedIds={selectedRegionIds} onToggle={(id, checked) => toggle(setSelectedRegionIds, selectedRegionIds, id, checked)} emptyText="No active regions are configured. Add regions in Facility setup before using this scope." /></div> : null}
    {scope === "regional-contact" ? <div><FieldLabel>Regional Manager or Director</FieldLabel><Checklist items={regionalContacts.map((contact) => ({ id: contact.id, label: contact.name || contact.title || "Unnamed Contact", helper: `${contact.contactRole || "Regional Contact"} | ${(contact.assignedFacilityIds || []).length} assigned facilities` }))} selectedIds={selectedRegionalContactIds} onToggle={(id, checked) => toggle(setSelectedRegionalContactIds, selectedRegionalContactIds, id, checked)} emptyText="No active regional contacts are configured in Settings → People & Contacts." /></div> : null}

    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}><div><strong style={{ color: colors.text }}>Report Columns</strong><span style={{ display: "block", color: colors.muted, fontSize: 12, marginTop: 3 }}>The order below is the Excel column order.</span></div><div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}><ActionButton onClick={() => { setSelectedColumnIds(REPORT_COLUMNS.map((column) => column.id)); setPreview(null); }}>Select All Columns</ActionButton><ActionButton onClick={() => { setSelectedColumnIds([]); setPreview(null); }}>Clear All Columns</ActionButton><ActionButton onClick={() => { setSelectedColumnIds([...DEFAULT_REPORT_COLUMN_IDS]); setPreview(null); }}>Reset to Default</ActionButton></div></div>
      <div style={{ display: "grid", gap: 6, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        {REPORT_COLUMNS.map((column) => {
          const checked = selectedColumnIds.includes(column.id);
          const order = selectedColumnIds.indexOf(column.id);
          return <div key={column.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 7, alignItems: "center", border: `1px solid ${checked ? colors.purple : colors.border}`, borderRadius: 6, padding: 8, background: checked ? colors.purpleLight : colors.panel }}><label style={{ display: "flex", gap: 7, alignItems: "center", cursor: "pointer" }}><input type="checkbox" checked={checked} onChange={(event) => toggle(setSelectedColumnIds, selectedColumnIds, column.id, event.target.checked)} /><span style={{ color: colors.text, fontWeight: 800 }}>{checked ? `${order + 1}. ` : ""}{column.label}</span></label>{checked ? <span style={{ display: "flex", gap: 4 }}><ActionButton disabled={order === 0} onClick={() => { setSelectedColumnIds(reorderSelectedColumn(selectedColumnIds, column.id, "up")); setPreview(null); }}>Move Up</ActionButton><ActionButton disabled={order === selectedColumnIds.length - 1} onClick={() => { setSelectedColumnIds(reorderSelectedColumn(selectedColumnIds, column.id, "down")); setPreview(null); }}>Move Down</ActionButton></span> : null}</div>;
        })}
      </div>
      {!selectedColumnIds.length ? <div role="alert" style={{ color: colors.red, fontWeight: 900 }}>Select at least one report column.</div> : null}
    </div>

    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end", borderTop: `1px solid ${colors.border}`, paddingTop: 12 }}>
      <label style={{ minWidth: 220 }}><FieldLabel>Save Named Preset</FieldLabel><input value={presetName} onChange={(event) => setPresetName(event.target.value)} placeholder="Custom preset name" style={{ width: "100%", boxSizing: "border-box", padding: 9, border: `1px solid ${colors.border}`, borderRadius: 6 }} /></label>
      <ActionButton onClick={savePreset}>Save Preset</ActionButton>
      <span style={{ flex: 1 }} />
      <ActionButton onClick={previewReport}>Preview Report</ActionButton>
      <ActionButton primary disabled={!selectedColumnIds.length || !hasLoaded} onClick={exportReport}>Export Excel</ActionButton>
    </div>

    {message ? <div role="status" style={{ color: /paused|select|could not|enter/i.test(message) ? colors.red : colors.purple, fontWeight: 850 }}>{message}</div> : null}
    {scopeError ? <div role="alert" style={{ color: colors.red, fontWeight: 900 }}>Select at least one facility, region, or regional contact.</div> : null}

    {preview ? <div style={{ border: `1px solid ${preview.canExport ? colors.purple : colors.red}`, borderRadius: 8, padding: 13, background: preview.canExport ? colors.purpleLight : "#fff5f5", display: "grid", gap: 10 }}>
      <div><strong style={{ color: colors.text }}>Report Preview</strong><span style={{ display: "block", color: colors.muted, fontSize: 12, marginTop: 3 }}>Summary only—candidate details remain inside the local workbook.</span></div>
      {preview.errors.length ? <div role="alert" style={{ color: colors.red }}>{preview.errors.join(" ")}</div> : null}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
        {[["Candidate rows", preview.totals.candidateRows], ["Requisitions", new Set(preview.rows.map((row) => row.values.reqNumber).filter(Boolean)).size], ["Facilities", preview.resolvedScope.facilityCount], ["Unresolved mappings", preview.dataQuality.filter((issue) => /unmapped|ambiguous/i.test(issue.Issue)).length]].map(([label, value]) => <div key={label} style={{ border: `1px solid ${colors.border}`, background: colors.panel, borderRadius: 6, padding: 10 }}><strong style={{ display: "block", color: colors.text, fontSize: 20 }}>{value}</strong><span style={{ color: colors.muted, fontSize: 12 }}>{label}</span></div>)}
      </div>
      <div><strong style={{ color: colors.text }}>Selected scope:</strong> <span style={{ color: colors.muted }}>{REPORT_SCOPE_OPTIONS.find((item) => item.id === scope)?.label} · {preview.resolvedScope.facilityCount} facilities</span></div>
      <div><strong style={{ color: colors.text }}>Selected columns:</strong> <span style={{ color: colors.muted }}>{selectedLabels.map((column) => column.label).join(", ") || "None"}</span></div>
      <div><strong style={{ color: colors.text }}>Expected workbook tabs:</strong> <span style={{ color: colors.muted }}>{preview.expectedTabs.join(", ") || "None"}</span></div>
    </div> : null}
  </section>;
}
