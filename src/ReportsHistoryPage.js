import React, { useEffect, useMemo, useState } from "react";
import { LEGACY_REPORT_STATUS_DISPLAY, reportingIssueContextRows } from "./weeklyReportingEligibility";
import {
  REPORTS_HISTORY_AUDIENCES,
  REPORTS_HISTORY_DESTINATIONS,
  REPORTS_HISTORY_STATUS_FILTERS,
  filterReportHistoryByView,
  normalizeReportsHistoryDestination,
} from "./reportsHistoryNavigation";

const HISTORICAL_REGENERATION_WARNING = "This workbook is regenerated from current workspace data and may differ from the version originally reviewed.";
const SAVED_HISTORY_QUERY_KEY = "historyReportId";

function values(value) {
  return Array.isArray(value) ? [...value] : [];
}

function commaValues(value) {
  if (Array.isArray(value)) return [...value];
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

export function readSavedHistoryTarget(search = "") {
  const params = new URLSearchParams(String(search || "").replace(/^\?/, ""));
  return String(params.get(SAVED_HISTORY_QUERY_KEY) || "").trim();
}

export function savedHistorySearch(search = "", recordId = "") {
  const params = new URLSearchParams(String(search || "").replace(/^\?/, ""));
  const id = String(recordId || "").trim();
  if (id) params.set(SAVED_HISTORY_QUERY_KEY, id);
  else params.delete(SAVED_HISTORY_QUERY_KEY);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function savedHistoryReviewContext(record = {}) {
  const workbookTabs = values(record.workbookTabs).length ? values(record.workbookTabs) : commaValues(record.attachmentTabs);
  const facilityIds = values(record.facilityIds).length ? values(record.facilityIds) : [record.facilityId].filter(Boolean);
  const reportIds = values(record.reportIds);
  const savedAudience = ["Facility", "Regional", "Executive"].includes(record.audience)
    ? record.audience
    : /regional/i.test(record.reportType || record.audience || "")
      ? "Regional"
      : /executive|c-suite|leadership/i.test(record.reportType || record.audience || "")
        ? "Executive"
        : "Facility";
  return {
    historyRecordId: String(record.id || "").trim(),
    reportId: String(record.reportId || record.stableReportId || "").trim(),
    reportIds,
    audience: savedAudience,
    reportType: record.reportType || "",
    recipient: record.recipient || record.recipientGroup || "",
    recipientGroup: record.recipientGroup || record.recipient || "",
    subject: record.emailSubject || record.subject || "",
    body: record.emailBody || record.body || "",
    attachmentName: record.attachmentName || "",
    attachmentType: record.attachmentType || "Recruiting workbook",
    workbookTabs,
    reportingPeriod: record.reportingPeriod || record.reportWeek || "",
    generatedAt: record.generatedAt || record.generatedDate || "",
    dataThrough: record.dataThrough || "",
    includedFacilityIds: facilityIds,
    canonicalTotals: { ...(record.canonicalTotals || {}) },
    status: record.status || "",
    sentStatus: record.sentStatus || "",
  };
}

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
  downloadAudienceReportListEntry,
  downloadHistoricalFacilityReport,
  downloadReportReviewWorkbook,
  eligibilityForReportRows,
  exportAtsUpdatePacketExcel,
  exportFacilityWorkbooks,
  exportHistoryExcel,
  exportWeeklyFullDataWorkbook,
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
  reportReviewListRows,
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
  weeklyReport,
  weeklySubject,
}) {
  const [selectedHistoryRecordId, setSelectedHistoryRecordId] = useState(() => (
    typeof window === "undefined" ? "" : readSavedHistoryTarget(window.location.search)
  ));
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const restoreSavedHistoryTarget = () => setSelectedHistoryRecordId(readSavedHistoryTarget(window.location.search));
    window.addEventListener("popstate", restoreSavedHistoryTarget);
    return () => window.removeEventListener("popstate", restoreSavedHistoryTarget);
  }, []);
  const selectedHistoryRecord = useMemo(
    () => (reportHistory || []).find((record) => String(record?.id || "") === selectedHistoryRecordId) || null,
    [reportHistory, selectedHistoryRecordId],
  );
  const selectedSavedHistoryContext = useMemo(
    () => (selectedHistoryRecord ? savedHistoryReviewContext(selectedHistoryRecord) : null),
    [selectedHistoryRecord],
  );
  const savedHistoryNotFound = Boolean(selectedHistoryRecordId && !selectedHistoryRecord);

  function updateSavedHistoryTarget(recordId, method = "pushState") {
    const id = String(recordId || "").trim();
    setSelectedHistoryRecordId(id);
    if (typeof window === "undefined") return;
    const search = savedHistorySearch(window.location.search, id);
    const location = `${window.location.pathname}${search}${window.location.hash}`;
    window.history[method]({ ...(window.history.state || {}), savedHistoryRecordId: id }, "", location);
  }

  function openSavedHistoryRecord(record) {
    const id = String(record?.id || "").trim();
    if (!id) return;
    updateSavedHistoryTarget(id, selectedHistoryRecordId === id ? "replaceState" : "pushState");
    setReportsHubTab("ready-review");
  }

  function returnToCurrentReport() {
    updateSavedHistoryTarget("", "pushState");
  }

  function selectLiveAudience(audience) {
    if (selectedHistoryRecordId) updateSavedHistoryTarget("", "pushState");
    setReportsReviewAudience(audience);
  }

  if (activePage !== "reporting") return null;

  const normalizedDestination = normalizeReportsHistoryDestination(reportsHubTab);
  const activeDestination = normalizedDestination.destination;
  const isCanonicalDestination = REPORTS_HISTORY_DESTINATIONS.some(({ value }) => value === reportsHubTab);
  const activeAudience = (isCanonicalDestination ? reportsReviewAudience : normalizedDestination.audience) || "Facility";
  const activeHistoryView = (isCanonicalDestination ? reportHistoryStatusView : normalizedDestination.historyFilter) || "All";
  const currentReportPeriod = `${reportStartDate || ""} to ${reportEndDate || ""}`;
  const visibleHistory = filterReportHistoryByView(reportHistoryFiltered, activeHistoryView, currentReportPeriod);
  const activeReviewContext = selectedSavedHistoryContext || reportReviewContext;
  const reviewingSavedHistory = Boolean(selectedSavedHistoryContext);
  const displayedAudience = activeReviewContext?.audience || activeAudience;
  const reviewBody = savedHistoryNotFound ? "" : (activeReviewContext?.body || (
    activeAudience === "Regional"
      ? regionalEmailBody(selectedFacilityActionRows)
      : activeAudience === "Executive"
        ? cSuiteEmailBody(selectedFacilityActionRows)
        : (weeklyReport || selectedAudienceEmailBody())
  ));
  const workbookSheets = reviewingSavedHistory
    ? activeReviewContext.workbookTabs.map((name) => ({ name }))
    : (activeReviewContext?.workbookSheets || buildAllFacilityWorkbookSheets());
  const attachmentName = activeReviewContext?.attachmentName || "";
  const latestGeneratedAt = activeReviewContext?.generatedAt || (reportHistory || [])[0]?.generatedDate || "";
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
                    primary={displayedAudience === audience}
                    subtle={displayedAudience !== audience}
                    aria-pressed={displayedAudience === audience}
                    onClick={() => selectLiveAudience(audience)}
                  >
                    {audience}
                  </Button>
                ))}
              </div>

              {savedHistoryNotFound ? (
                <div role="alert" style={{ border: `1px solid ${THEME.red}`, borderRadius: 6, padding: 12, background: THEME.panelAlt }}>
                  <strong>Historical report not found</strong>
                  <div style={{ marginTop: 5 }}>No saved report history record matches <strong>{selectedHistoryRecordId}</strong>.</div>
                  <div style={{ marginTop: 10 }}><Button subtle onClick={returnToCurrentReport}>Return to Current Report</Button></div>
                </div>
              ) : null}

              {reviewingSavedHistory ? (
                <div aria-label="Saved history review mode" style={{ border: `1px solid ${THEME.primary2}`, borderRadius: 6, padding: 12, background: THEME.blueBg }}>
                  <strong>Saved History Review</strong>
                  <div style={{ marginTop: 4 }}>Reviewing saved record {selectedSavedHistoryContext.historyRecordId}. This mode does not change the current live report.</div>
                  <div style={{ marginTop: 4 }}>Saved status: {selectedSavedHistoryContext.status || "Not recorded"}</div>
                  <div style={{ marginTop: 10 }}><Button subtle onClick={returnToCurrentReport}>Return to Current Report</Button></div>
                </div>
              ) : null}

              {!savedHistoryNotFound ? <div style={{ display: "grid", gap: 10, gridTemplateColumns: isNarrow ? "1fr" : "repeat(2, minmax(0, 1fr))" }}>
                <div style={{ border: `1px solid ${THEME.borderSoft}`, borderRadius: 6, padding: 12, background: THEME.panel }}>
                  <div style={{ color: THEME.muted, fontSize: 11, fontWeight: 900, textTransform: "uppercase" }}>Email</div>
                  <div aria-label="Report audience metadata" style={{ marginTop: 8 }}><strong>Audience:</strong> {displayedAudience}</div>
                  <div aria-label="Report recipient" style={{ marginTop: 6 }}><strong>Recipient:</strong> {activeReviewContext?.recipient || activeReviewContext?.recipientGroup || selectedRecipientGroup || displayedAudience}</div>
                  <div aria-label="Report subject" style={{ marginTop: 6 }}><strong>Subject:</strong> {activeReviewContext?.subject || weeklySubject || `${selectedReportType || displayedAudience} report`}</div>
                  <div style={{ marginTop: 10, whiteSpace: "pre-wrap", lineHeight: 1.65 }}>{reviewBody}</div>
                </div>
                <div style={{ border: `1px solid ${THEME.borderSoft}`, borderRadius: 6, padding: 12, background: THEME.panel }}>
                  <div style={{ color: THEME.muted, fontSize: 11, fontWeight: 900, textTransform: "uppercase" }}>Attachment</div>
                  <div aria-label="Attachment name" style={{ marginTop: 8 }}><strong>Attachment name:</strong> {attachmentName}</div>
                  <div aria-label="Attachment type" style={{ marginTop: 6 }}><strong>Attachment type:</strong> {activeReviewContext?.attachmentType || "Recruiting workbook"}</div>
                  <div aria-label="Workbook tabs" style={{ marginTop: 6 }}><strong>Workbook tabs:</strong> {workbookSheets.map((sheet) => sheet.name).join(", ") || "No tabs available"}</div>
                  <div aria-label="Reporting period" style={{ marginTop: 6 }}><strong>Reporting period:</strong> {activeReviewContext?.reportingPeriod || currentReportPeriod}</div>
                  <div style={{ marginTop: 6 }}><strong>Generated time:</strong> {latestGeneratedAt ? displayDate(String(latestGeneratedAt).slice(0, 10)) : "Not generated this session"}</div>
                  <div style={{ marginTop: 6 }}><strong>Data-through time:</strong> {activeReviewContext?.dataThrough ? displayDate(activeReviewContext.dataThrough) : reportEndDate ? displayDate(reportEndDate) : "Not available"}</div>
                </div>
              </div> : null}

              {!reviewingSavedHistory && !savedHistoryNotFound && (blockers.length || warnings.length) ? (
                <div style={{ border: `1px solid ${blockers.length ? THEME.red : THEME.borderSoft}`, borderRadius: 6, padding: 12, background: THEME.panelAlt }}>
                  <strong>{blockers.length ? "Blocking issues" : "Warnings"}</strong>
                  {blockers.map((issue, index) => <ReportingIssueReview key={`blocker-${index}`} Button={Button} issue={issue} onCorrect={(targetIssue) => openReportingIssueCorrection?.(targetIssue, { reportsTab: "review-reports", audience: activeAudience, recipientGroup: reportReviewContext?.recipientGroup || selectedRecipientGroup })} THEME={THEME} />)}
                  {warnings.map((issue, index) => <div key={`warning-${index}`} style={{ marginTop: 6 }}>{issueLabel(issue)}</div>)}
                  <div style={{ color: THEME.muted, fontSize: 12, marginTop: 8 }}>Diagnostic details remain available even when final actions are blocked.</div>
                </div>
              ) : null}

              {!savedHistoryNotFound && (reviewingSavedHistory ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Button subtle onClick={() => safeCopy(reviewBody)}>Copy Saved Email Body</Button>
                  <Button subtle onClick={() => downloadHistoricalFacilityReport(selectedHistoryRecord)}>Download Current-Data Regenerated Workbook</Button>
                </div>
              ) : <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
              </div>)}
            </div>
          </Card>

          {!reviewingSavedHistory && !savedHistoryNotFound ? <Card title={`${activeAudience} Reports`} subtitle="Selected report scopes remain governed by the existing eligibility rules." compact>
            <div style={{ display: "grid", gap: 10 }}>
              {reportReviewListRows?.length ? reportReviewListRows.map((row) => {
                const sourceRows = Array.isArray(row.sourceRows) ? row.sourceRows : [];
                const rowEligibility = eligibilityForReportRows(sourceRows);
                const facilityScope = (row.facilities || []).map((facility) => (
                  `${facility.facilityName} (${facility.facilityId})`
                )).join(", ");
                const regionScope = (row.regionNames || row.regionIds || []).join(", ");
                return (
                  <div key={row.reportId || row.key} data-testid={`audience-report-row-${row.key}`} style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "1.3fr 1fr 1fr auto", gap: 10, alignItems: "center", border: `1px solid ${row.status === "Blocked" ? THEME.red : THEME.borderSoft}`, borderRadius: 6, padding: 10, background: THEME.panel }}>
                    <div>
                      <strong>{row.title}</strong>
                      <div style={{ color: THEME.muted, fontSize: 12 }}>{row.subject}</div>
                      <div aria-label={`${row.audience} report-list scope`} style={{ color: THEME.muted, fontSize: 11, marginTop: 4 }}>
                        Facilities: {facilityScope || "None"}{regionScope ? ` | Regions: ${regionScope}` : ""} | Report IDs: {(row.reportIds || []).join(", ") || "None"}
                      </div>
                      <div aria-label={`${row.audience} report-list metadata`} style={{ color: THEME.muted, fontSize: 11, marginTop: 3 }}>
                        Recipient: {row.recipientGroup} | Attachment: {row.attachmentName}
                      </div>
                    </div>
                    <Badge tone={row.status === "Blocked" ? "High" : row.status === "Needs Review" ? "Medium" : "Low"}>{LEGACY_REPORT_STATUS_DISPLAY[row.status] || row.status}</Badge>
                    <span style={{ color: THEME.muted }}>{row.workbookTabs?.length || 0} attachment tabs</span>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Button subtle disabled={!rowEligibility.canViewDraftPreview} onClick={() => openReportReview?.(sourceRows, { audience: row.audience, reportType: row.reportType, recipientGroup: row.recipientGroup })}>Review Report</Button>
                      <Button subtle disabled={!rowEligibility.canDownloadWorkbook} onClick={() => downloadAudienceReportListEntry?.(row)}>Download Workbook</Button>
                    </div>
                  </div>
                );
              }) : <EmptyState>No report-eligible facilities are selected.</EmptyState>}
            </div>
          </Card> : null}
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
                          <Button subtle onClick={() => openSavedHistoryRecord(record)} style={{ padding: "6px 8px", fontSize: 11 }}>View Saved Report Details</Button>
                          <Button subtle onClick={() => safeCopy(record.emailBody)} style={{ padding: "6px 8px", fontSize: 11 }}>Copy Email Body</Button>
                        </div>
                        <div style={{ color: THEME.muted, fontSize: 10 }}>{HISTORICAL_REGENERATION_WARNING}</div>
                        <Button subtle onClick={() => downloadHistoricalFacilityReport(record)} style={{ padding: "6px 8px", fontSize: 11 }}>Download Current-Data Regenerated Workbook</Button>
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
