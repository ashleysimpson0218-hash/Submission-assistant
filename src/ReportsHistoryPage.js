import React from "react";
import { LEGACY_REPORT_STATUS_DISPLAY, reportingIssueContextRows } from "./weeklyReportingEligibility";
import {
  REPORTS_HISTORY_AUDIENCES,
  REPORTS_HISTORY_DESTINATIONS,
  REPORTS_HISTORY_STATUS_FILTERS,
  filterReportHistoryByView,
  normalizeReportsHistoryDestination,
} from "./reportsHistoryNavigation";

const HISTORICAL_REGENERATION_WARNING = "This workbook is regenerated from current workspace data and may differ from the version originally reviewed.";

function issueLabel(issue) {
  if (typeof issue === "string") return issue;
  const label = issue?.message || issue?.label || issue?.issue || issue?.reason || issue?.code || "Reporting issue";
  return issue?.detail ? `${label}: ${issue.detail}` : label;
}

function ReportingIssueReview({ Button, issue, onCorrect, THEME }) {
  const contextRows = reportingIssueContextRows(issue);
  return (
    <div style={{ borderTop: `1px solid ${THEME.borderSoft}`, marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
      <div>
        <strong>{issueLabel(issue)}</strong>
        {contextRows.length ? (
          <dl style={{ display: "grid", gap: 3, margin: "6px 0 0", fontSize: 11 }}>
            {contextRows.map(({ label, value }) => (
              <div key={label} style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                <dt style={{ color: THEME.muted, fontWeight: 850 }}>{label}:</dt>
                <dd style={{ margin: 0, color: THEME.text }}>{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
      {issue?.resolutionAction && onCorrect ? <Button subtle onClick={() => onCorrect(issue)}>{issue.resolutionAction}</Button> : null}
    </div>
  );
}

function settingSurfaceCard(Button, title, description, actionLabel, onClick) {
  return (
    <div style={{ border: "1px solid #e9d5ff", borderRadius: 6, padding: 12, display: "grid", gap: 8 }}>
      <strong>{title}</strong>
      <span style={{ color: "#6b7280", fontSize: 12 }}>{description}</span>
      <div><Button subtle onClick={onClick}>{actionLabel}</Button></div>
    </div>
  );
}

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
  downloadReportReviewWorkbook,
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
  markSelectedFacilityReportsReviewed,
  markSelectedFacilityReportsSent,
  openReportReview,
  openReportingIssueCorrection,
  openReportingSettingsSurface,
  regionalEmailBody,
  reportEndDate,
  reportFacilityNames,
  reportHistory,
  reportHistoryFiltered,
  reportHistoryFilters,
  reportHistoryStatusView,
  reportInclusions,
  reportStartDate,
  reportTypeOptions,
  reportsHubTab,
  reportsReviewAudience,
  reportReviewContext,
  reportingActionState,
  safeCopy,
  saveReportsToHistory,
  selectedAudienceEmailBody,
  selectedFacilityActionRows,
  selectedRecipientGroup,
  selectedReportEligibility,
  selectedReportType,
  setReportHistoryFilters,
  setReportHistoryStatusView,
  setReportInclusions,
  setReportsHubTab,
  setReportsReviewAudience,
  setWeeklyReport,
  setWeeklySubject,
  weeklyReport,
  weeklySubject,
}) {
  if (activePage !== "reporting") return null;

  const normalizedDestination = normalizeReportsHistoryDestination(reportsHubTab);
  const activeDestination = normalizedDestination.destination;
  const isCanonicalDestination = REPORTS_HISTORY_DESTINATIONS.some(({ value }) => value === reportsHubTab);
  const activeAudience = (isCanonicalDestination ? reportsReviewAudience : normalizedDestination.audience) || "Facility";
  const activeHistoryView = (isCanonicalDestination ? reportHistoryStatusView : normalizedDestination.historyFilter) || "All";
  const currentReportPeriod = `${reportStartDate || ""} to ${reportEndDate || ""}`;
  const visibleHistory = filterReportHistoryByView(reportHistoryFiltered, activeHistoryView, currentReportPeriod);
  const reviewBody = reportReviewContext?.body || (
    activeAudience === "Regional"
      ? regionalEmailBody(selectedFacilityActionRows)
      : activeAudience === "Executive"
        ? cSuiteEmailBody(selectedFacilityActionRows)
        : (weeklyReport || selectedAudienceEmailBody())
  );
  const workbookSheets = reportReviewContext?.workbookSheets || buildAllFacilityWorkbookSheets();
  const attachmentName = reportReviewContext?.attachmentName || "";
  const latestGeneratedAt = reportReviewContext?.generatedAt || (reportHistory || [])[0]?.generatedDate || "";
  const blockers = selectedReportEligibility?.blockingReasons || [];
  const warnings = selectedReportEligibility?.warnings
    || (selectedReportEligibility?.scopedIssues || []).filter((issue) => !issue.blocking);

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <Card title="Reports & History" subtitle="Review current reports, revisit prior activity, and manage existing reporting settings." compact>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: isNarrow ? "1fr" : "repeat(3, minmax(0, 1fr))" }}>
          {REPORTS_HISTORY_DESTINATIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setReportsHubTab(value)}
              style={{
                border: `1px solid ${activeDestination === value ? THEME.primary2 : THEME.borderSoft}`,
                borderRadius: 6,
                padding: 10,
                background: activeDestination === value ? THEME.blueBg : THEME.panelAlt,
                color: THEME.text,
                fontWeight: 850,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </Card>

      {activeDestination === "ready-review" ? (
        <>
          <Card title="Ready to Review" subtitle="Review the email and workbook together before taking an explicit reporting action." compact>
            <div style={{ display: "grid", gap: 14 }}>
              <div role="group" aria-label="Report audience" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {REPORTS_HISTORY_AUDIENCES.map((audience) => (
                  <Button
                    key={audience}
                    primary={activeAudience === audience}
                    subtle={activeAudience !== audience}
                    aria-pressed={activeAudience === audience}
                    onClick={() => setReportsReviewAudience(audience)}
                  >
                    {audience}
                  </Button>
                ))}
              </div>

              <div style={{ display: "grid", gap: 10, gridTemplateColumns: isNarrow ? "1fr" : "repeat(2, minmax(0, 1fr))" }}>
                <div style={{ border: `1px solid ${THEME.borderSoft}`, borderRadius: 6, padding: 12, background: THEME.panel }}>
                  <div style={{ color: THEME.muted, fontSize: 11, fontWeight: 900, textTransform: "uppercase" }}>Email</div>
                  <div aria-label="Report audience metadata" style={{ marginTop: 8 }}><strong>Audience:</strong> {reportReviewContext?.audience || activeAudience}</div>
                  <div aria-label="Report recipient" style={{ marginTop: 6 }}><strong>Recipient:</strong> {reportReviewContext?.recipientGroup || selectedRecipientGroup || activeAudience}</div>
                  <div aria-label="Report subject" style={{ marginTop: 6 }}><strong>Subject:</strong> {reportReviewContext?.subject || weeklySubject || `${selectedReportType || activeAudience} report`}</div>
                  <div style={{ marginTop: 10, whiteSpace: "pre-wrap", lineHeight: 1.65 }}>{reviewBody}</div>
                </div>
                <div style={{ border: `1px solid ${THEME.borderSoft}`, borderRadius: 6, padding: 12, background: THEME.panel }}>
                  <div style={{ color: THEME.muted, fontSize: 11, fontWeight: 900, textTransform: "uppercase" }}>Attachment</div>
                  <div aria-label="Attachment name" style={{ marginTop: 8 }}><strong>Attachment name:</strong> {attachmentName}</div>
                  <div aria-label="Attachment type" style={{ marginTop: 6 }}><strong>Attachment type:</strong> {reportReviewContext?.attachmentType || "Recruiting workbook"}</div>
                  <div aria-label="Workbook tabs" style={{ marginTop: 6 }}><strong>Workbook tabs:</strong> {workbookSheets.map((sheet) => sheet.name).join(", ") || "No tabs available"}</div>
                  <div aria-label="Reporting period" style={{ marginTop: 6 }}><strong>Reporting period:</strong> {currentReportPeriod}</div>
                  <div style={{ marginTop: 6 }}><strong>Generated time:</strong> {latestGeneratedAt ? displayDate(String(latestGeneratedAt).slice(0, 10)) : "Not generated this session"}</div>
                  <div style={{ marginTop: 6 }}><strong>Data-through time:</strong> {reportEndDate ? displayDate(reportEndDate) : "Not available"}</div>
                </div>
              </div>

              {blockers.length || warnings.length ? (
                <div style={{ border: `1px solid ${blockers.length ? THEME.red : THEME.borderSoft}`, borderRadius: 6, padding: 12, background: THEME.panelAlt }}>
                  <strong>{blockers.length ? "Blocking issues" : "Warnings"}</strong>
                  {blockers.map((issue, index) => <ReportingIssueReview key={`blocker-${index}`} Button={Button} issue={issue} onCorrect={(targetIssue) => openReportingIssueCorrection?.(targetIssue, { reportsTab: "review-reports", audience: activeAudience, recipientGroup: reportReviewContext?.recipientGroup || selectedRecipientGroup })} THEME={THEME} />)}
                  {warnings.map((issue, index) => <div key={`warning-${index}`} style={{ marginTop: 6 }}>{issueLabel(issue)}</div>)}
                  <div style={{ color: THEME.muted, fontSize: 12, marginTop: 8 }}>Diagnostic details remain available even when final actions are blocked.</div>
                </div>
              ) : null}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Button
                  primary
                  onClick={() => openReportReview?.(selectedFacilityActionRows, {
                    audience: activeAudience,
                    reportType: reportReviewContext?.reportType || selectedReportType,
                    recipientGroup: reportReviewContext?.recipientGroup || selectedRecipientGroup,
                  })}
                  disabled={!reportingActionState.selectedPreviewableReportIds.length}
                >
                  Review Report
                </Button>
                <Button subtle onClick={() => copyReportEmailContent(reviewBody, "Email body")} disabled={!reportingActionState.selectedEmailReportIds.length || reportingActionState.selectedEmailReportIds.length !== selectedFacilityActionRows.length}>Copy Email Body</Button>
                <Button subtle onClick={downloadReportReviewWorkbook} disabled={!reportingActionState.selectedDownloadableReportIds.length || reportingActionState.selectedDownloadableReportIds.length !== selectedFacilityActionRows.length}>Download Workbook</Button>
                <Button subtle disabled={!selectedFacilityActionRows.length} onClick={() => saveReportsToHistory(selectedFacilityActionRows, "Draft Generated")}>Save Draft to History</Button>
                <Button subtle disabled={!reportingActionState.selectedMarkReviewedReportIds.length} onClick={markSelectedFacilityReportsReviewed}>Mark Reviewed</Button>
                <Button subtle disabled={!reportingActionState.selectedMarkSentReportIds.length} onClick={markSelectedFacilityReportsSent}>Mark Sent</Button>
              </div>
            </div>
          </Card>

          <Card title={`${activeAudience} Reports`} subtitle="Selected report scopes remain governed by the existing eligibility rules." compact>
            <div style={{ display: "grid", gap: 10 }}>
              {selectedFacilityActionRows.length ? selectedFacilityActionRows.map((row) => {
                const model = facilityReportModel(row.facilityId || row.id || row.facility);
                const content = facilityEmailContent(model, row.reportType || selectedReportType);
                const rowEligibility = eligibilityForReportRows([row]);
                return (
                  <div key={row.id} style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "1.3fr 1fr 1fr auto", gap: 10, alignItems: "center", border: `1px solid ${model.missingContact ? THEME.red : THEME.borderSoft}`, borderRadius: 6, padding: 10, background: THEME.panel }}>
                    <div><strong>{model.facility}</strong><div style={{ color: THEME.muted, fontSize: 12 }}>{content.subject}</div></div>
                    <Badge tone={model.missingContact ? "High" : row.status === "Needs Review" ? "Medium" : "Low"}>{model.missingContact ? "Blocked, Missing Contact" : (LEGACY_REPORT_STATUS_DISPLAY[row.status] || row.status)}</Badge>
                    <span style={{ color: THEME.muted }}>{facilityWorkbookSheets(model).length} attachment tabs</span>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Button subtle disabled={!rowEligibility.canViewDraftPreview} onClick={() => openReportReview?.(row, { audience: activeAudience, reportType: reportReviewContext?.reportType || row.reportType || selectedReportType, recipientGroup: reportReviewContext?.recipientGroup || selectedRecipientGroup })}>Review Report</Button>
                      <Button subtle disabled={!rowEligibility.canDownloadWorkbook} onClick={() => downloadGeneratedFacilityReport(row)}>Download Workbook</Button>
                    </div>
                  </div>
                );
              }) : <EmptyState>No report-eligible facilities are selected.</EmptyState>}
            </div>
          </Card>
        </>
      ) : null}

      {activeDestination === "sent-history" ? (
        <>
          <Card title="Sent & History" subtitle="Filter saved report activity without changing any record status." compact>
            <div style={{ display: "grid", gap: 12 }}>
              <div role="group" aria-label="History status" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {REPORTS_HISTORY_STATUS_FILTERS.map((view) => (
                  <Button key={view} primary={activeHistoryView === view} subtle={activeHistoryView !== view} aria-pressed={activeHistoryView === view} onClick={() => setReportHistoryStatusView(view)}>{view}</Button>
                ))}
              </div>
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: isNarrow ? "1fr" : "repeat(5, minmax(0, 1fr))" }}>
                <Field label="Facility"><SelectInput value={reportHistoryFilters.facility} onChange={(event) => setReportHistoryFilters((prev) => ({ ...prev, facility: event.target.value }))} options={["All", ...reportFacilityNames]} /></Field>
                <Field label="Report Type"><SelectInput value={reportHistoryFilters.reportType} onChange={(event) => setReportHistoryFilters((prev) => ({ ...prev, reportType: event.target.value }))} options={["All", ...reportTypeOptions]} /></Field>
                <Field label="Saved Status"><SelectInput value={reportHistoryFilters.status} onChange={(event) => setReportHistoryFilters((prev) => ({ ...prev, status: event.target.value }))} options={["All", "Draft Generated", "Needs Review", "Reviewed", "Ready to Send", "Sent", "Held for Approval", "Blocked, Missing Contact", "Downloaded Only", "Copied", "Exported", "Manually Completed"]} /></Field>
                <Field label="Start"><TextInput type="date" value={reportHistoryFilters.start} onChange={(event) => setReportHistoryFilters((prev) => ({ ...prev, start: event.target.value }))} /></Field>
                <Field label="End"><TextInput type="date" value={reportHistoryFilters.end} onChange={(event) => setReportHistoryFilters((prev) => ({ ...prev, end: event.target.value }))} /></Field>
              </div>
              {visibleHistory.length ? (
                <div style={{ border: `1px solid ${THEME.borderSoft}`, borderRadius: 6, padding: 10, background: THEME.panelAlt }}>
                  <strong>Historical workbook notice</strong>
                  <div style={{ marginTop: 4 }}>{HISTORICAL_REGENERATION_WARNING}</div>
                </div>
              ) : null}
              <div style={{ overflowX: "auto" }}>
                <div style={{ minWidth: isNarrow ? 920 : 0, display: "grid", gap: 8 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "130px 130px 1fr 150px 140px 170px 1fr 280px", gap: 8, color: THEME.muted, fontSize: 10, fontWeight: 900, textTransform: "uppercase", padding: "0 8px" }}><span>Report Week</span><span>Generated</span><span>Facility</span><span>Report Type</span><span>Audience</span><span>Status</span><span>Attachment</span><span>Actions</span></div>
                  {visibleHistory.length ? visibleHistory.map((record) => (
                    <div key={record.id} style={{ display: "grid", gridTemplateColumns: "130px 130px 1fr 150px 140px 170px 1fr 280px", gap: 8, alignItems: "center", border: `1px solid ${record.status === "Blocked, Missing Contact" ? THEME.red : THEME.borderSoft}`, borderRadius: 6, padding: 8, background: THEME.panel }}>
                      <span>{record.reportWeek}</span>
                      <span>{displayDate(String(record.generatedDate || "").slice(0, 10))}</span>
                      <strong>{record.facility}</strong>
                      <span>{record.reportType}</span>
                      <span>{record.audience}</span>
                      <Badge tone={record.status === "Blocked, Missing Contact" ? "High" : record.status === "Held for Approval" || record.status === "Needs Review" ? "Medium" : "Low"}>{LEGACY_REPORT_STATUS_DISPLAY[record.status] || record.status}</Badge>
                      <span style={{ color: THEME.muted }}>{record.attachmentName}{record.missingContactWarning ? <><br />{record.missingContactWarning}</> : null}</span>
                      <div style={{ display: "grid", gap: 6 }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <Button subtle onClick={() => { setWeeklySubject(record.emailSubject); setWeeklyReport(record.emailBody); setReportsHubTab("ready-review"); }} style={{ padding: "6px 8px", fontSize: 11 }}>View Saved Report Details</Button>
                          <Button subtle onClick={() => safeCopy(record.emailBody)} style={{ padding: "6px 8px", fontSize: 11 }}>Copy Email Body</Button>
                        </div>
                        <div style={{ color: THEME.muted, fontSize: 10 }}>{HISTORICAL_REGENERATION_WARNING}</div>
                        <Button subtle onClick={() => downloadHistoricalFacilityReport(record)} style={{ padding: "6px 8px", fontSize: 11 }}>Regenerate Workbook Using Current Data</Button>
                      </div>
                    </div>
                  )) : <EmptyState>No report history matches this view.</EmptyState>}
                </div>
              </div>
            </div>
          </Card>

          <Card title="Download Tools" subtitle="Downloads remain explicit and do not change Reviewed, Ready, or Sent status." compact>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button primary onClick={exportWeeklyFullDataWorkbook} disabled={!selectedReportEligibility.canDownloadWorkbook}>Download Combined Workbook</Button>
              <Button subtle onClick={exportFacilityWorkbooks}>Download Separate Facility Workbooks</Button>
              <Button subtle onClick={exportHistoryExcel} disabled={!history.length}>Download History Excel</Button>
              <Button subtle onClick={exportAtsUpdatePacketExcel}>Download ATS Packet Excel</Button>
            </div>
            <div style={{ marginTop: 14, display: "grid", gap: 10, gridTemplateColumns: isNarrow ? "1fr" : "repeat(2, minmax(0, 1fr))" }}>
              <MiniStat label="Report-eligible Selected Facilities" value={selectedFacilityActionRows.length} tone="Interview" compact />
              <MiniStat label="Attachment Tabs" value={workbookSheets.length} tone="Low" compact />
            </div>
          </Card>
        </>
      ) : null}

      {activeDestination === "templates-settings" ? (
        <Card title="Templates & Settings" subtitle="Open the existing reporting setup surfaces without creating new settings or persistence." compact>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: isNarrow ? "1fr" : "repeat(3, minmax(0, 1fr))" }}>
              {settingSurfaceCard(Button, "Email Templates", "Edit the existing reusable report email wording.", "Open Email Templates", () => openReportingSettingsSurface("email-templates"))}
              {settingSurfaceCard(Button, "Recipient Setup", "Manage the existing facility and reporting contacts.", "Open Recipient Setup", () => openReportingSettingsSurface("recipients"))}
              {settingSurfaceCard(Button, "Report Presets", "Open existing named report presets and scope choices.", "Open Report Presets", () => openReportingSettingsSurface("report-presets"))}
              {settingSurfaceCard(Button, "Workbook Defaults", "Manage existing workbook layout and inclusion defaults.", "Open Workbook Defaults", () => openReportingSettingsSurface("workbook-defaults"))}
              {settingSurfaceCard(Button, "No-Openings Policy", "Choose how facilities without openings are handled.", "Open No-Openings Policy", () => openReportingSettingsSurface("no-openings"))}
              {settingSurfaceCard(Button, "Reporting Automation", "Open the existing Automation Center reporting controls.", "Open Reporting Automation", () => openReportingSettingsSurface("automation"))}
            </div>
            <div>
              <strong>Workbook inclusion defaults</strong>
              <div style={{ display: "grid", gap: 8, gridTemplateColumns: isNarrow ? "1fr" : "repeat(3, minmax(0, 1fr))", marginTop: 8 }}>
                {Object.entries(reportInclusions).map(([key, value]) => <ToggleField key={key} label={labelFromKey(key)} checked={Boolean(value)} onChange={(checked) => setReportInclusions((prev) => ({ ...prev, [key]: checked }))} />)}
              </div>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

export { HISTORICAL_REGENERATION_WARNING };
