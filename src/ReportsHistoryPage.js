import React from "react";
import { LEGACY_REPORT_STATUS_DISPLAY } from "./weeklyReportingEligibility";

export function ReportsHistoryPage({
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  MiniStat,
  SelectInput,
  TextInput,
  ToggleField,
  THEME,
  activePage,
  buildAllFacilityWorkbookSheets,
  cSuiteEmailBody,
  copyReportEmailContent,
  displayDate,
  downloadGeneratedFacilityReport,
  downloadHistoricalFacilityReport,
  eligibilityForReportRows,
  exportAtsUpdatePacketExcel,
  exportFacilityWorkbooks,
  exportHistoryExcel,
  exportWeeklyFullDataWorkbook,
  facilityEmailContent,
  facilityReportModel,
  facilityWorkbookSheets,
  history,
  isNarrow,
  labelFromKey,
  openReportAutomationSettings,
  previewSelectedFacilityReports,
  regionalEmailBody,
  reportFacilityNames,
  reportHistoryFiltered,
  reportHistoryFilters,
  reportInclusions,
  reportTypeOptions,
  reportsHubTab,
  reportsTab,
  safeCopy,
  saveReportsToHistory,
  selectedAudienceEmailBody,
  selectedFacilityActionRows,
  selectedReportEligibility,
  selectedReportType,
  setReportHistoryFilters,
  setReportInclusions,
  setReportsHubTab,
  setWeeklyReport,
  setWeeklySubject,
  weeklyReport,
  weeklySubject,
}) {
  return activePage === "reports" && reportsTab === "hub" ? (
    <div style={{ display: "grid", gap: 18 }}>
      <Card title="Reports Hub" subtitle="Preview concise email snapshots, download detailed Excel attachments, and revisit generated report history." compact action={<Button subtle onClick={openReportAutomationSettings}>Report Settings</Button>}>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: isNarrow ? "repeat(2, minmax(0, 1fr))" : "repeat(5, minmax(0, 1fr))" }}>
          {[
            ["preview", "Report Preview"],
            ["generated", "Generated Reports"],
            ["history", "Report History"],
            ["facility", "Facility Reports"],
            ["regional", "Regional Reports"],
            ["csuite", "C-Suite Reports"],
            ["download", "Download Center"],
            ["email", "Email Preview"],
            ["attachment", "Attachment Preview"],
            ["settings", "Report Settings"],
          ].map(([value, label]) => <button key={value} type="button" onClick={() => setReportsHubTab(value)} style={{ border: `1px solid ${reportsHubTab === value ? THEME.primary2 : THEME.borderSoft}`, borderRadius: 6, padding: 10, background: reportsHubTab === value ? THEME.blueBg : THEME.panelAlt, color: THEME.text, fontWeight: 850, cursor: "pointer", textAlign: "left" }}>{label}</button>)}
        </div>
      </Card>

      {reportsHubTab === "preview" || reportsHubTab === "email" ? (
        <Card title="Email Preview" subtitle="The email stays high-level. The Excel attachment carries the detail." compact>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button primary onClick={previewSelectedFacilityReports} disabled={!selectedReportEligibility.canCreateFinalPreview}>Preview Email</Button>
              <Button subtle onClick={() => copyReportEmailContent(weeklyReport || selectedAudienceEmailBody(), "Email body")} disabled={!selectedReportEligibility.canPrepareEmail}>Copy Email</Button>
              <Button subtle onClick={() => copyReportEmailContent(weeklySubject, "Email subject")} disabled={!selectedReportEligibility.canPrepareEmail}>Copy Subject</Button>
              <Button subtle disabled={!selectedFacilityActionRows.length} onClick={() => saveReportsToHistory(selectedFacilityActionRows, "Reviewed")}>Mark Reviewed</Button>
              <Button subtle disabled={!selectedFacilityActionRows.length} onClick={() => saveReportsToHistory(selectedFacilityActionRows, "Held for Approval")}>Hold for Approval</Button>
              <Button subtle disabled>Send Later</Button>
            </div>
            <div style={{ border: `1px dashed ${THEME.border}`, borderRadius: 6, padding: 14, background: THEME.panelAlt, whiteSpace: "pre-wrap", lineHeight: 1.65 }}>{weeklyReport || selectedAudienceEmailBody()}</div>
          </div>
        </Card>
      ) : null}

      {reportsHubTab === "generated" || reportsHubTab === "facility" || reportsHubTab === "regional" || reportsHubTab === "csuite" ? (
        <Card title="Generated Reports" subtitle="Report-ready audience drafts based on the current Weekly Cleanup selections." compact>
          <div style={{ display: "grid", gap: 10 }}>
            {selectedFacilityActionRows.map((row) => {
              const model = facilityReportModel(row.facilityId || row.id || row.facility);
              const content = facilityEmailContent(model, row.reportType || selectedReportType);
              const subject = content.subject;
              const rowEligibility = eligibilityForReportRows([row]);
              return <div key={row.id} style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "1.3fr 1fr 1fr auto", gap: 10, alignItems: "center", border: `1px solid ${model.missingContact ? THEME.red : THEME.borderSoft}`, borderRadius: 6, padding: 10, background: THEME.panel }}><div><strong>{model.facility}</strong><div style={{ color: THEME.muted, fontSize: 12 }}>{subject}</div></div><Badge tone={model.missingContact ? "High" : row.status === "Needs Review" ? "Medium" : "Low"}>{model.missingContact ? "Blocked, Missing Contact" : (LEGACY_REPORT_STATUS_DISPLAY[row.status] || row.status)}</Badge><span style={{ color: THEME.muted }}>{facilityWorkbookSheets(model).length} attachment tabs</span><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Button subtle disabled={!rowEligibility.canCreateFinalPreview} onClick={() => { setWeeklySubject(subject); setWeeklyReport(content.body); }}>Preview</Button><Button subtle disabled={!rowEligibility.canDownloadWorkbook} onClick={() => downloadGeneratedFacilityReport(row)}>Download</Button></div></div>;
            })}
            {selectedReportType === "Regional Manager Summary" ? <Card compact title="Regional Manager Email" subtitle="Grouped by selected facilities."><div style={{ whiteSpace: "pre-wrap", lineHeight: 1.65 }}>{regionalEmailBody(selectedFacilityActionRows)}</div></Card> : null}
            {selectedReportType === "C-Suite Leadership Report" ? <Card compact title="C-Suite Leadership Email" subtitle="High-level leadership visibility."><div style={{ whiteSpace: "pre-wrap", lineHeight: 1.65 }}>{cSuiteEmailBody(selectedFacilityActionRows)}</div></Card> : null}
          </div>
        </Card>
      ) : null}

      {reportsHubTab === "history" ? (
        <Card title="Report History" subtitle="Visible record of generated weekly reports and their email/attachment details." compact>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: isNarrow ? "1fr" : "repeat(5, minmax(0, 1fr))" }}>
              <Field label="Facility"><SelectInput value={reportHistoryFilters.facility} onChange={(event) => setReportHistoryFilters((prev) => ({ ...prev, facility: event.target.value }))} options={["All", ...reportFacilityNames]} /></Field>
              <Field label="Report Type"><SelectInput value={reportHistoryFilters.reportType} onChange={(event) => setReportHistoryFilters((prev) => ({ ...prev, reportType: event.target.value }))} options={["All", ...reportTypeOptions]} /></Field>
              <Field label="Status"><SelectInput value={reportHistoryFilters.status} onChange={(event) => setReportHistoryFilters((prev) => ({ ...prev, status: event.target.value }))} options={["All", "Draft Generated", "Needs Review", "Ready to Send", "Sent", "Held for Approval", "Blocked, Missing Contact", "Downloaded Only"]} /></Field>
              <Field label="Start"><TextInput type="date" value={reportHistoryFilters.start} onChange={(event) => setReportHistoryFilters((prev) => ({ ...prev, start: event.target.value }))} /></Field>
              <Field label="End"><TextInput type="date" value={reportHistoryFilters.end} onChange={(event) => setReportHistoryFilters((prev) => ({ ...prev, end: event.target.value }))} /></Field>
            </div>
            <div style={{ overflowX: "auto" }}>
              <div style={{ minWidth: isNarrow ? 900 : 0, display: "grid", gap: 8 }}>
                <div style={{ display: "grid", gridTemplateColumns: "130px 130px 1fr 150px 140px 150px 1fr 220px", gap: 8, color: THEME.muted, fontSize: 10, fontWeight: 900, textTransform: "uppercase", padding: "0 8px" }}><span>Report Week</span><span>Generated</span><span>Facility</span><span>Report Type</span><span>Audience</span><span>Status</span><span>Attachment</span><span>Actions</span></div>
                {reportHistoryFiltered.length ? reportHistoryFiltered.map((record) => <div key={record.id} style={{ display: "grid", gridTemplateColumns: "130px 130px 1fr 150px 140px 150px 1fr 220px", gap: 8, alignItems: "center", border: `1px solid ${record.status === "Blocked, Missing Contact" ? THEME.red : THEME.borderSoft}`, borderRadius: 6, padding: 8, background: THEME.panel }}><span>{record.reportWeek}</span><span>{displayDate(String(record.generatedDate || "").slice(0, 10))}</span><strong>{record.facility}</strong><span>{record.reportType}</span><span>{record.audience}</span><Badge tone={record.status === "Blocked, Missing Contact" ? "High" : record.status === "Held for Approval" || record.status === "Needs Review" ? "Medium" : "Low"}>{LEGACY_REPORT_STATUS_DISPLAY[record.status] || record.status}</Badge><span style={{ color: THEME.muted }}>{record.attachmentName}{record.missingContactWarning ? <><br />{record.missingContactWarning}</> : null}</span><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><Button subtle onClick={() => { setWeeklySubject(record.emailSubject); setWeeklyReport(record.emailBody); setReportsHubTab("email"); }} style={{ padding: "6px 8px", fontSize: 11 }}>Preview</Button><Button subtle onClick={() => safeCopy(record.emailBody)} style={{ padding: "6px 8px", fontSize: 11 }}>Copy</Button><Button subtle onClick={() => downloadHistoricalFacilityReport(record)} style={{ padding: "6px 8px", fontSize: 11 }}>Download</Button></div></div>) : <EmptyState>No reports have been saved to history yet.</EmptyState>}
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {reportsHubTab === "download" || reportsHubTab === "attachment" ? (
        <Card title="Download Center" subtitle="Download detailed Excel attachments without changing the concise email body." compact>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button primary onClick={exportWeeklyFullDataWorkbook} disabled={!selectedReportEligibility.canDownloadWorkbook}>Download All-Facility Excel</Button>
            <Button subtle onClick={exportFacilityWorkbooks}>Download Facility Excel Files</Button>
            <Button subtle onClick={exportHistoryExcel} disabled={!history.length}>Download History Excel</Button>
            <Button subtle onClick={exportAtsUpdatePacketExcel}>Download ATS Packet Excel</Button>
          </div>
          <div style={{ marginTop: 14, display: "grid", gap: 10, gridTemplateColumns: isNarrow ? "1fr" : "repeat(2, minmax(0, 1fr))" }}>
            <MiniStat label="Report-eligible Selected Facilities" value={selectedFacilityActionRows.length} tone="Interview" compact />
            <MiniStat label="Attachment Tabs" value={buildAllFacilityWorkbookSheets().length} tone="Low" compact />
          </div>
        </Card>
      ) : null}

      {reportsHubTab === "settings" ? (
        <Card title="Report Settings Shortcut" subtitle="Automation rules stay in Automation Center. Inclusion choices affect this week's workbook output." compact>
          <div style={{ display: "grid", gap: 10 }}>
            <Button primary onClick={openReportAutomationSettings}>Open Automation Center Report Automation</Button>
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: isNarrow ? "1fr" : "repeat(3, minmax(0, 1fr))" }}>{Object.entries(reportInclusions).map(([key, value]) => <ToggleField key={key} label={labelFromKey(key)} checked={Boolean(value)} onChange={(checked) => setReportInclusions((prev) => ({ ...prev, [key]: checked }))} />)}</div>
          </div>
        </Card>
      ) : null}
    </div>
  ) : null;
}
