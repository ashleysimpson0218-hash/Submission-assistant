import React from "react";
import WeeklyCleanupReportBuilder from "./WeeklyCleanupReportBuilder";
import { FACILITY_READINESS_OPTIONS } from "./facilityReadinessNavigation";
import { NO_OPENINGS_POLICIES, NO_OPENINGS_POLICY_OPTIONS, NO_OPENINGS_WEEKLY_DECISIONS } from "./noOpeningFacilityPolicy";
import { previewSelectedReportsLabel } from "./reportContext";
import { LEGACY_REPORT_STATUS_DISPLAY } from "./weeklyReportingEligibility";
import {
  WEEKLY_REPORTING_STEPS,
  weeklyReportingScopeText,
  weeklyReportingStepNumber,
} from "./weeklyReportingWorkflow";

export function WeeklyReportingPage(props) {
  const {
    Accordion,
    Badge,
    Button,
    Card,
    EmailDocument,
    EmptyState,
    Field,
    FileButton,
    MiniStat,
    ReportDetailPanel,
    ReportTile,
    SelectInput,
    TextInput,
    ToggleField,
    THEME,
    activePage,
    activeReportSection,
    allowManualCompletion,
    atsCleanupFilter,
    atsCleanupRows,
    atsCleanupSearch,
    candidateTimingDelayRows,
    restartWeeklyReview,
    clearFacilityReportSelection,
    cloudStatus,
    copySelectedFacilityReports,
    copyWeeklyReport,
    displayDate,
    downloadExcelWorkbook,
    downloadSelectedSubmittals,
    eligibilityForReportRows,
    excludedReportIds,
    expandedReportIssueCode,
    exportAtsCleanupCsv,
    exportAtsUpdatePacketExcel,
    exportFacilityWorkbooks,
    exportFullBackup,
    exportHistoryCsv,
    exportHistoryExcel,
    exportSelectedFacilityReports,
    exportTrackerCsv,
    exportWeeklyFullDataWorkbook,
    facilityReadinessFilters,
    facilityReadinessIssueGroups,
    facilityReadinessMatchingRows,
    facilityReadinessRegions,
    facilityReadinessRows,
    facilityReadinessSelection,
    facilityReadinessStatusCounts,
    facilityReadinessVisibleRows,
    facilityReportQueueFiltered,
    hasLoaded,
    history,
    importAtsStatusSpreadsheet,
    includedReportRows,
    isMedium,
    isNarrow,
    labelFromKey,
    markSelectedAtsUpdated,
    markSelectedFacilityReportsReviewed,
    markSelectedFacilityReportsSent,
    noOpeningsPolicy,
    noOpeningsPolicyDraft,
    noOpeningsPolicySelection,
    noOpeningWeeklyDecisions,
    openReportAutomationSettings,
    openReportingIssueCorrection,
    openReportReview,
    openTentativeStartReminder,
    previewSelectedFacilityReports,
    recipientGroupOptions,
    removeFromWeeklyReport,
    reportAutomation,
    reportAutomationDay,
    reportAutomationEnabled,
    reportAutomationTime,
    reportCategories,
    reportCompletionSummary,
    reportEndDate,
    reportFacilityNames,
    reportInclusions,
    reportIssueGroups,
    reportRequisitionGroups,
    reportRequisitionMetrics,
    reportSendMode,
    reportSourceMetrics,
    reportStartDate,
    reportStatusOptions,
    reportTiles,
    reportTypeOptions,
    reportsTab,
    restoreWeeklyReportRows,
    safeTrackerRows,
    saveNoOpeningsPolicy,
    saveReportsToHistory,
    selectAllMatchingFacilityReports,
    selectAllVisibleFacilityReports,
    selectedFacility,
    selectedFacilityActionEligibility,
    selectedFacilityActionRows,
    selectedFacilityPolicyRows,
    selectedFacilityReports,
    selectedRecipientGroup,
    selectedReportEligibility,
    selectedReportType,
    selectedStatusFilter,
    selectedTrackerIds,
    sendReadyFacilityReports,
    setActivePage,
    setActiveReportSection,
    setAtsCleanupFilter,
    setAtsCleanupSearch,
    setExpandedReportIssueCode,
    setFacilityReadinessVisibleLimit,
    setNoOpeningsPolicyDraft,
    setReportInclusions,
    setReportsTab,
    setSelectedFacility,
    setSelectedFacilityReports,
    setSelectedId,
    setSelectedRecipientGroup,
    setSelectedReportType,
    setSelectedStatusFilter,
    setSelectedTrackerIds,
    setSettings,
    setTrackerPanelOpen,
    setWeeklyNoOpeningDecision,
    settings,
    timingSummary,
    toggleFacilityReportSelection,
    toggleTrackerSelection,
    tracker,
    undoNoOpeningWeeklyDecision,
    updateFacilityReadinessFilter,
    weeklyReport,
    weeklyReportingBlockerCount,
    weeklyReportingPrimaryAction,
    weeklySubject,
  } = props;
  return (
    <>
        {activePage === "reports" ? (
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ position: "sticky", top: 0, zIndex: 12 }}>
              <Card compact>
                <div style={{ display: "grid", gap: 12, gridTemplateColumns: isNarrow ? "1fr" : "minmax(0, 1fr) auto", alignItems: "center" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <h1 style={{ margin: 0, color: THEME.text, fontSize: 22, fontWeight: 950 }}>Weekly Reporting</h1>
                      <Badge tone="Interview">Step {weeklyReportingStepNumber(reportsTab)} of 5</Badge>
                    </div>
                    <div style={{ color: THEME.muted, fontSize: 12, marginTop: 4 }}>{displayDate(reportStartDate)} to {displayDate(reportEndDate)}</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                      <Badge tone={weeklyReportingBlockerCount ? "High" : "Low"}>{weeklyReportingBlockerCount} Blocked</Badge>
                      <Badge tone="Low">{facilityReadinessStatusCounts.Ready || 0} Ready</Badge>
                      <Badge tone="Interview">{facilityReadinessStatusCounts["No Report Required"] || 0} No Report Required</Badge>
                      <Badge tone="Low">{facilityReadinessStatusCounts.Sent || 0} Sent</Badge>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: isNarrow ? "flex-start" : "flex-end" }}>
                    <Button primary disabled={weeklyReportingPrimaryAction.disabled} onClick={() => setReportsTab(weeklyReportingPrimaryAction.targetStep)}>{weeklyReportingPrimaryAction.label}</Button>
                    <details style={{ position: "relative" }}>
                      <summary style={{ cursor: "pointer", color: THEME.primary2, fontWeight: 900, padding: "8px 10px" }}>More</summary>
                      <div style={{ position: isNarrow ? "static" : "absolute", right: 0, marginTop: 6, minWidth: 210, padding: 8, border: `1px solid ${THEME.borderSoft}`, borderRadius: 7, background: THEME.panel, boxShadow: THEME.shadow }}>
                        <Button subtle onClick={restartWeeklyReview}>Restart Weekly Review</Button>
                      </div>
                    </details>
                  </div>
                </div>
              </Card>
            </div>
            <Card compact>
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: isNarrow ? "1fr" : "repeat(5, minmax(0, 1fr))" }}>
                {WEEKLY_REPORTING_STEPS.map((step, index) => (
                  <button key={step.key} type="button" onClick={() => setReportsTab(step.key)} aria-current={reportsTab === step.key ? "step" : undefined} style={{ border: `1px solid ${reportsTab === step.key ? THEME.primary2 : THEME.borderSoft}`, borderRadius: 6, padding: "10px 11px", background: reportsTab === step.key ? THEME.blueBg : THEME.panelAlt, color: THEME.text, cursor: "pointer", textAlign: "left", fontWeight: 850, fontSize: 12 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: 999, background: reportsTab === step.key ? THEME.primary2 : THEME.panel, color: reportsTab === step.key ? "#fff" : THEME.primary2, marginRight: 8 }}>{index + 1}</span>
                    <span>{step.label}</span>
                    {reportsTab === step.key ? <span style={{ display: "block", height: 3, background: THEME.primary2, borderRadius: 999, marginTop: 8 }} /> : null}
                  </button>
                ))}
              </div>
            </Card>
            <div role="note" style={{ border: `1px solid ${THEME.borderSoft}`, borderRadius: 7, padding: "9px 11px", background: THEME.panelAlt, color: THEME.muted, fontSize: 12 }}>{weeklyReportingScopeText(reportsTab)}</div>
          </div>
        ) : null}

        {activePage === "reports" && reportsTab === "candidate-cleanup" ? (() => {
          const rows = atsCleanupRows().map((row) => ({ ...row, tracker: tracker.find((item) => item.id === row.id) }));
          const counts = {
            all: rows.length,
            needsReview: rows.filter((row) => !row.atsUpdatedAt).length,
            ready: rows.filter((row) => `${row.status} ${row.nextAction}`.toLowerCase().includes("ready")).length,
            unresponsive: rows.filter((row) => `${row.status} ${row.nextAction}`.toLowerCase().includes("unresponsive")).length,
            updated: rows.filter((row) => row.atsUpdatedAt).length,
          };
          const query = atsCleanupSearch.trim().toLowerCase();
          const filteredRows = rows.filter((row) => {
            const haystack = [row.candidate, row.tracker?.candidateEmail, row.tracker?.formSnapshot?.emailAddress, row.reqNumber, row.position, row.facility, row.status, row.nextAction].filter(Boolean).join(" ").toLowerCase();
            const matchesSearch = !query || haystack.includes(query);
            const matchesFilter = atsCleanupFilter === "All"
              || (atsCleanupFilter === "Needs Review" && !row.atsUpdatedAt)
              || (atsCleanupFilter === "Ready for Intake" && `${row.status} ${row.nextAction}`.toLowerCase().includes("ready"))
              || (atsCleanupFilter === "Unresponsive" && `${row.status} ${row.nextAction}`.toLowerCase().includes("unresponsive"))
              || (atsCleanupFilter === "Updated" && row.atsUpdatedAt);
            return matchesSearch && matchesFilter;
          });
          const allVisibleSelected = Boolean(filteredRows.length) && filteredRows.every((row) => selectedTrackerIds.includes(row.id));
          const toggleAllVisible = () => setSelectedTrackerIds((prev) => allVisibleSelected ? prev.filter((id) => !filteredRows.some((row) => row.id === id)) : Array.from(new Set([...prev, ...filteredRows.map((row) => row.id)])));
          const chipDefs = [
            ["All", "All", counts.all, THEME.primary2, THEME.blueBg],
            ["Needs Review", "Needs Review", counts.needsReview, THEME.amber, THEME.amberBg],
            ["Ready for Intake", "Ready for Intake", counts.ready, THEME.green, THEME.greenBg],
            ["Unresponsive", "Unresponsive", counts.unresponsive, THEME.red, THEME.redBg],
            ["Updated", "Updated", counts.updated, THEME.primary2, THEME.blueBg],
          ];
          const statusTone = (status) => {
            const lower = String(status || "").toLowerCase();
            if (lower.includes("unresponsive") || lower.includes("risk") || lower.includes("reject")) return "High";
            if (lower.includes("ready") || lower.includes("offer") || lower.includes("hired")) return "Low";
            if (lower.includes("interview")) return "Interview";
            return "Medium";
          };
          return (
            <div style={{ display: "grid", gap: 18 }}>
              <Card compact>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "start", flexWrap: "wrap", marginBottom: 14 }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 18 }}>ATS Cleanup Center</h2>
                    <div style={{ color: THEME.muted, fontSize: 12, marginTop: 4 }}>Review and clean ATS records before generating your weekly report.</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <Button subtle onClick={exportAtsCleanupCsv}>Download ATS Cleanup CSV</Button>
                    <Button primary onClick={exportAtsUpdatePacketExcel}>Export ATS Packet Excel</Button>
                    <FileButton accept=".xlsx,.xltx,.xlsm,.xls,.xml,.csv,text/csv,.txt" onText={importAtsStatusSpreadsheet}>Import ATS Status</FileButton>
                    <Button subtle onClick={markSelectedAtsUpdated} disabled={!selectedTrackerIds.length}>Mark Selected ATS Updated</Button>
                    <Button subtle onClick={downloadSelectedSubmittals} disabled={!selectedTrackerIds.length}>Download Selected ATS Packet</Button>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {chipDefs.map(([key, label, count, color, bg]) => (
                      <button key={key} type="button" onClick={() => setAtsCleanupFilter(key)} style={{ border: `1px solid ${atsCleanupFilter === key ? color : THEME.borderSoft}`, borderRadius: 999, padding: "7px 10px", background: atsCleanupFilter === key ? bg : THEME.panelAlt, color: atsCleanupFilter === key ? color : THEME.muted, cursor: "pointer", fontWeight: 900, fontSize: 11 }}>{label} ({count})</button>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <Button subtle onClick={() => setAtsCleanupFilter("All")} style={{ padding: "7px 10px", fontSize: 11 }}>Filters</Button>
                    <TextInput value={atsCleanupSearch} onChange={(event) => setAtsCleanupSearch(event.target.value)} placeholder="Search candidates..." style={{ minWidth: 220, height: 34 }} />
                  </div>
                </div>
                {!filteredRows.length ? <EmptyState>No ATS cleanup items match this view.</EmptyState> : (
                  <div style={{ overflowX: "auto", border: `1px solid ${THEME.borderSoft}`, borderRadius: 8, background: THEME.panel }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1160 }}>
                      <thead>
                        <tr style={{ background: THEME.panelAlt }}>
                          {["", "Candidate", "Req #", "Position", "Facility", "Status", "Next Action", "Submitted", "Aging", "ATS Updated", "Last Touch"].map((head, index) => (
                            <th key={head || "select"} style={{ textAlign: "left", color: THEME.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.45, padding: "11px 10px", borderBottom: `1px solid ${THEME.borderSoft}` }}>{index === 0 ? <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} /> : head}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.map((item) => (
                          <tr key={`${item.id}-${item.submitted}`} style={{ background: selectedTrackerIds.includes(item.id) ? THEME.blueBg : THEME.panel }}>
                            <td style={{ padding: 10, borderBottom: `1px solid ${THEME.borderSoft}` }}><input type="checkbox" checked={selectedTrackerIds.includes(item.id)} onChange={() => toggleTrackerSelection(item.id)} /></td>
                            <td style={{ padding: 10, borderBottom: `1px solid ${THEME.borderSoft}` }}><strong>{item.candidate}</strong><div style={{ color: THEME.muted, fontSize: 11, marginTop: 2 }}>{item.tracker?.candidateEmail || item.tracker?.formSnapshot?.emailAddress || "No email"}</div></td>
                            <td style={{ padding: 10, borderBottom: `1px solid ${THEME.borderSoft}`, color: THEME.muted }}>{item.reqNumber || "N/A"}</td>
                            <td style={{ padding: 10, borderBottom: `1px solid ${THEME.borderSoft}` }}>{item.position || "N/A"}</td>
                            <td style={{ padding: 10, borderBottom: `1px solid ${THEME.borderSoft}`, color: THEME.muted }}>{item.facility || "N/A"}</td>
                            <td style={{ padding: 10, borderBottom: `1px solid ${THEME.borderSoft}` }}><Badge tone={statusTone(item.status)}>{item.status || "No status"}</Badge></td>
                            <td style={{ padding: 10, borderBottom: `1px solid ${THEME.borderSoft}`, color: THEME.muted }}>{item.nextAction || "No next action"}</td>
                            <td style={{ padding: 10, borderBottom: `1px solid ${THEME.borderSoft}`, color: THEME.muted }}>{displayDate(item.submitted)}</td>
                            <td style={{ padding: 10, borderBottom: `1px solid ${THEME.borderSoft}`, color: item.agingDays > 14 ? THEME.red : item.agingDays > 7 ? THEME.amber : THEME.muted, fontWeight: 900 }}>{item.agingDays} days</td>
                            <td style={{ padding: 10, borderBottom: `1px solid ${THEME.borderSoft}`, color: item.atsUpdatedAt ? THEME.green : THEME.muted, fontWeight: 800 }}>{item.atsUpdatedAt ? new Date(item.atsUpdatedAt).toLocaleDateString() : "Not yet"}</td>
                            <td style={{ padding: 10, borderBottom: `1px solid ${THEME.borderSoft}`, color: THEME.muted }}>{item.lastTouch ? new Date(item.lastTouch).toLocaleDateString() : "N/A"}<div style={{ fontSize: 11 }}>{item.historyCount} touch{item.historyCount === 1 ? "" : "es"}</div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: 10, color: THEME.muted, fontSize: 12 }}>
                      <span>Showing {filteredRows.length} of {rows.length} candidates</span>
                      <span>{selectedTrackerIds.length} selected</span>
                    </div>
                  </div>
                )}
              </Card>
              <Card compact>
                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 10, alignItems: "start" }}>
                  <span style={{ color: THEME.primary2, fontWeight: 950 }}> </span>
                  <div><strong>What this page is for</strong><p style={{ margin: "4px 0 0", color: THEME.muted, lineHeight: 1.6 }}>Use this page to review candidates that need ATS updates, resolve stale records, and clean your system before generating the weekly report. Statuses are based on last activity, response, and submission data.</p></div>
                </div>
              </Card>
            </div>
          );
        })() : null}

        {activePage === "reports" && reportsTab === "overview" ? (
          <div style={{ display: "grid", gap: 18 }}>
            <div style={{ display: "grid", gap: 14 }}>
              <Card title="Metrics + Reporting" subtitle="Review included rows, removable candidates, and leadership-ready sections." compact>
                <div style={{ display: "grid", gap: 14 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <Badge tone="Interview">{includedReportRows.length} Included</Badge>
                    <Badge tone={excludedReportIds.length ? "High" : "Low"}>{excludedReportIds.length} Removed before generate</Badge>
                    {excludedReportIds.length ? <Button subtle onClick={restoreWeeklyReportRows}>Restore Removed Rows</Button> : null}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Button subtle onClick={exportHistoryCsv} disabled={!history.length}>Export History CSV</Button>
                    <Button subtle onClick={exportHistoryExcel} disabled={!history.length}>Export History Excel</Button>
                  </div>
                  <div style={{ display: "grid", gap: 12, gridTemplateColumns: isNarrow ? "1fr" : "repeat(3, minmax(0, 1fr))" }}>
                    {reportTiles.map((tile) => <ReportTile key={tile.key} item={tile} active={activeReportSection === tile.key} onClick={() => setActiveReportSection(tile.key)} />)}
                  </div>
                  <Accordion title={reportTiles.find((tile) => tile.key === activeReportSection)?.label || "Report Details"} subtitle="Click into each section, review the rows, and remove anything that should not generate.">
                    <ReportDetailPanel section={activeReportSection} rows={reportCategories[activeReportSection] || []} sourceRows={reportSourceMetrics} requisitionRows={reportRequisitionMetrics} requisitionGroups={reportRequisitionGroups} settings={settings} onRemove={removeFromWeeklyReport} onOpenCandidate={(item) => { setSelectedId(item.id); setActivePage("workspace"); setTrackerPanelOpen(false); }} onOpenReminder={openTentativeStartReminder} compact={isNarrow} />
                  </Accordion>
                </div>
              </Card>
              <Card title="Candidate Timing + Delay Review" subtitle={`${timingSummary.timingDelays} active timing delay${timingSummary.timingDelays === 1 ? "" : "s"} surfaced from candidate movement timestamps. Completed, hired, onboarding, archived, and closed candidates are cleared from action-needed timing alerts.`} compact>
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ display: "grid", gap: 10, gridTemplateColumns: isNarrow ? "1fr" : "repeat(5, minmax(0, 1fr))" }}>
                    <MiniStat label="Timing Delays" value={timingSummary.timingDelays} tone={timingSummary.timingDelays ? "Medium" : "Low"} compact />
                    <MiniStat label="High/Critical Risk" value={timingSummary.highOrCritical} tone={timingSummary.highOrCritical ? "High" : "Low"} compact />
                    <MiniStat label="Avg Response" value={timingSummary.outreachResponse} tone="Interview" compact />
                    <MiniStat label="Submit To Interview" value={timingSummary.submittalToInterview} tone="Interview" compact />
                    <MiniStat label="Interview To Decision" value={timingSummary.interviewToDecision} tone="Interview" compact />
                  </div>
                  {!candidateTimingDelayRows.length ? <EmptyState>No active timing delays are currently flagged for this report period.</EmptyState> : (
                    <div style={{ overflowX: "auto" }}>
                      <div style={{ display: "grid", gap: 8, minWidth: isNarrow ? 0 : 920 }}>
                        <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "1.1fr 1fr 1fr 90px 1.2fr auto", gap: 10, padding: "0 10px", color: THEME.muted, fontSize: 10, fontWeight: 900, textTransform: "uppercase" }}>
                          <span>Candidate</span><span>Stage</span><span>Delay Type</span><span>Waiting</span><span>Next Action</span><span>Open</span>
                        </div>
                        {candidateTimingDelayRows.slice(0, 8).map((row) => (
                          <div key={row.candidateId} style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "1.1fr 1fr 1fr 90px 1.2fr auto", gap: 10, alignItems: "center", border: `1px solid ${row.candidateTimingRisk === "Critical" || row.candidateTimingRisk === "High" ? THEME.amber : THEME.borderSoft}`, borderRadius: 6, padding: 10, background: THEME.panel }}>
                            <div><strong>{row.candidateName || "Unnamed Candidate"}</strong><div style={{ color: THEME.muted, fontSize: 12 }}>{row.position || "No position"} | {row.facility || "No facility"}</div></div>
                            <div><Badge tone={row.candidateTimingRisk === "High" || row.candidateTimingRisk === "Critical" ? "High" : row.candidateTimingRisk === "Medium" ? "Medium" : "Low"}>{row.mainStage}</Badge><div style={{ color: THEME.muted, fontSize: 11, marginTop: 4 }}>{row.currentActionStatus}</div></div>
                            <div>{row.delayType}</div>
                            <div>{row.daysSinceLastAction || 0}d</div>
                            <strong>{row.nextRecommendedAction}</strong>
                            <Button subtle onClick={() => { setSelectedId(row.candidateId); setActivePage("workspace"); setTrackerPanelOpen(false); }} style={{ padding: "6px 8px", fontSize: 11 }}>Open</Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
              {false ? (
              <div style={{ display: "none", gap: 14 }}>
                <Card title="Facility Report Completion" subtitle={`${reportCompletionSummary.done} of ${reportCompletionSummary.total} facility reports complete. ${reportCompletionSummary.remaining} remaining.`} compact>
                  <div style={{ display: "grid", gap: 12 }}>
                    <div style={{ border: `1px solid ${THEME.borderSoft}`, borderRadius: 999, height: 12, background: THEME.panelAlt, overflow: "hidden" }}>
                      <div style={{ width: `${reportCompletionSummary.total ? Math.round((reportCompletionSummary.done / reportCompletionSummary.total) * 100) : 0}%`, height: "100%", background: `linear-gradient(90deg, ${THEME.primary2}, ${THEME.green})` }} />
                    </div>
                    <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
                      <MiniStat label="Done" value={reportCompletionSummary.done} tone="Low" compact />
                      <MiniStat label="Scheduled" value={reportCompletionSummary.scheduled} tone={reportCompletionSummary.scheduled ? "Interview" : "Low"} compact />
                      <MiniStat label="Review" value={reportCompletionSummary.review} tone={reportCompletionSummary.review ? "Medium" : "Low"} compact />
                      <MiniStat label="Missing" value={reportCompletionSummary.missing} tone={reportCompletionSummary.missing ? "High" : "Low"} compact />
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {["All", "Needs Action", "Missing Contacts", "Scheduled"].map((filter) => <Button key={filter} subtle={selectedStatusFilter !== filter} primary={selectedStatusFilter === filter} onClick={() => setSelectedStatusFilter(filter)} style={{ padding: "7px 9px", fontSize: 11 }}>{filter}</Button>)}
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 90px 105px 1fr 70px", gap: 8, color: THEME.muted, fontSize: 10, fontWeight: 900, textTransform: "uppercase", padding: "0 4px" }}>
                        <span>Facility</span><span>Report</span><span>Status</span><span>Last Action</span><span>Action</span>
                      </div>
                      {facilityReportQueueFiltered.slice(0, 5).map((row) => (
                        <div key={row.id} style={{ display: "grid", gridTemplateColumns: "1.1fr 90px 105px 1fr 70px", gap: 8, alignItems: "center", border: `1px solid ${row.status === "Missing Contact" ? THEME.red : row.status === "Needs Review" ? THEME.amber : THEME.borderSoft}`, borderRadius: 6, padding: 8, background: THEME.panel }}>
                          <strong style={{ fontSize: 12 }}>{row.facility}</strong>
                          <span style={{ color: THEME.muted, fontSize: 12 }}>{row.report}</span>
                          <Badge tone={row.status === "Missing Contact" ? "High" : row.status === "Needs Review" ? "Medium" : row.complete ? "Low" : "Interview"}>{LEGACY_REPORT_STATUS_DISPLAY[row.status] || row.status}</Badge>
                          <span style={{ color: THEME.muted, fontSize: 12 }}>{row.lastAction}</span>
                            <Button subtle disabled={!eligibilityForReportRows([row]).canCreateFinalPreview} onClick={() => { setSelectedFacility(row.facility); setSelectedFacilityReports([row.id]); previewSelectedFacilityReports([row]); }} style={{ padding: "6px 7px", fontSize: 11 }}>{row.action}</Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
                <Card title="Weekly Report Preview" subtitle="Preview your weekly report before sharing." compact>
                  <div style={{ border: `1px dashed ${THEME.border}`, borderRadius: 6, minHeight: 260, padding: 16, background: THEME.panelAlt, display: "grid", placeItems: weeklyReport ? "stretch" : "center" }}>
                    {weeklyReport ? <EmailDocument title="Weekly Report" subject={weeklySubject} body={weeklyReport} attachmentLabel="Download Excel Workbook" onDownloadAttachment={exportWeeklyFullDataWorkbook} onMarkSent={markSelectedFacilityReportsSent} attachmentNotice="Mailto opens the email body only. Download this Excel attachment, then attach it to the draft before sending. After sending, use Mark Sent to document completion." /> : <div style={{ textAlign: "center", color: THEME.muted }}><div style={{ fontSize: 36, marginBottom: 10 }}> </div><strong style={{ color: THEME.text }}>No weekly report preview has been created yet.</strong></div>}
                  </div>
                </Card>
              </div>
              ) : null}
            </div>
            {false ? (
            <div style={{ display: "none" }}>
            <Card title="Audience Report Queue + Sender" subtitle="Choose the audience, review the facility queue, then preview, copy, export, send, or mark reports complete." compact>
              <div style={{ display: "grid", gap: 14 }}>
                <div style={{ display: "grid", gap: 10, gridTemplateColumns: isNarrow ? "1fr" : "repeat(4, minmax(0, 1fr))" }}>
                  <Field label="Facility"><SelectInput value={selectedFacility} onChange={(event) => { setSelectedFacility(event.target.value); setSelectedFacilityReports([]); }} options={["All Facilities", "Facilities With Openings", "Facilities With No Openings", ...reportFacilityNames]} /></Field>
                  <Field label="Report Type"><SelectInput value={selectedReportType} onChange={(event) => setSelectedReportType(event.target.value)} options={reportTypeOptions} /></Field>
                  <Field label="Recipient Group"><SelectInput value={selectedRecipientGroup} onChange={(event) => setSelectedRecipientGroup(event.target.value)} options={recipientGroupOptions} /></Field>
                  <Field label="Status Filter"><SelectInput value={selectedStatusFilter} onChange={(event) => { setSelectedStatusFilter(event.target.value); setSelectedFacilityReports([]); }} options={reportStatusOptions} /></Field>
                </div>
                <div style={{ display: "grid", gap: 12, gridTemplateColumns: isMedium ? "1fr" : "minmax(0, 1fr) 280px", alignItems: "start" }}>
                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Button primary onClick={() => previewSelectedFacilityReports()} disabled={!selectedFacilityActionRows.length || !selectedFacilityActionEligibility.canCreateFinalPreview}>{previewSelectedReportsLabel(selectedFacilityActionRows.length)}</Button>
                      <Button subtle onClick={copySelectedFacilityReports} disabled={!selectedFacilityActionRows.length || !selectedFacilityActionEligibility.canPrepareEmail}>Copy Email Body</Button>
                      <Button subtle onClick={exportSelectedFacilityReports} disabled={!selectedFacilityActionRows.length || !selectedFacilityActionEligibility.canDownloadWorkbook}>Download Combined Workbook</Button>
                      <Button subtle onClick={markSelectedFacilityReportsReviewed} disabled={!allowManualCompletion || !selectedFacilityActionRows.length || !selectedFacilityActionEligibility.canMarkReady}>Mark Reviewed</Button>
                      <Button subtle onClick={markSelectedFacilityReportsSent} disabled={!selectedFacilityActionRows.length || !selectedFacilityActionEligibility.canPrepareEmail}>Mark Sent</Button>
                      <Button primary onClick={sendReadyFacilityReports} disabled={!selectedFacilityActionRows.length || !selectedFacilityActionEligibility.canPrepareEmail || !selectedFacilityActionEligibility.canMarkReady}>Review {selectedFacilityActionRows.length} Ready Reports</Button>
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <div style={{ minWidth: isNarrow ? 760 : 0, display: "grid", gap: 8 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "34px 1.2fr 120px 140px 1fr 90px", gap: 10, padding: "0 10px", color: THEME.muted, fontSize: 10, fontWeight: 900, textTransform: "uppercase" }}>
                          <span />
                          <span>Facility</span>
                          <span>Report</span>
                          <span>Status</span>
                          <span>Last Action</span>
                          <span>Action</span>
                        </div>
                        {facilityReportQueueFiltered.length ? facilityReportQueueFiltered.map((row) => (
                          <div key={row.id} style={{ display: "grid", gridTemplateColumns: "34px 1.2fr 120px 140px 1fr 90px", gap: 10, alignItems: "center", border: `1px solid ${selectedFacilityReports.includes(row.id) ? THEME.primary2 : THEME.borderSoft}`, borderRadius: 6, padding: 10, background: selectedFacilityReports.includes(row.id) ? THEME.blueBg : THEME.panel }}>
                            <input type="checkbox" checked={selectedFacilityReports.includes(row.id)} onChange={(event) => toggleFacilityReportSelection(row.id, event.target.checked)} aria-label={`Select ${row.facility} report`} />
                            <strong>{row.facility}</strong>
                            <span style={{ color: THEME.muted }}>{row.report}</span>
                            <Badge tone={row.status === "Missing Contact" ? "High" : row.status === "Needs Review" ? "Medium" : row.complete ? "Low" : "Interview"}>{LEGACY_REPORT_STATUS_DISPLAY[row.status] || row.status}</Badge>
                            <span style={{ color: THEME.muted }}>{row.lastAction}</span>
                            <Button subtle onClick={() => { setSelectedFacilityReports([row.id]); previewSelectedFacilityReports([row]); }} style={{ padding: "6px 8px", fontSize: 11 }}>{row.action}</Button>
                          </div>
                        )) : <EmptyState>No facility reports match this filter.</EmptyState>}
                      </div>
                    </div>
                  </div>
                  <div style={{ border: `1px solid ${reportAutomationEnabled ? THEME.green : THEME.borderSoft}`, borderRadius: 8, padding: 14, background: reportAutomationEnabled ? THEME.greenBg : THEME.panelAlt, display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                      <strong>Automation Status</strong>
                      <Badge tone={reportAutomationEnabled ? "Low" : "Medium"}>{reportAutomationEnabled ? "Active" : "Off"}</Badge>
                    </div>
                    <div style={{ color: THEME.muted, fontSize: 12, lineHeight: 1.6 }}>
                      Schedule: <strong style={{ color: THEME.text }}>{reportAutomationDay} at {reportAutomationTime}</strong><br />
                      Send mode: <strong style={{ color: THEME.text }}>{reportSendMode}</strong>
                    </div>
                    <Button primary onClick={openReportAutomationSettings}>Manage Report Automation</Button>
                  </div>
                </div>
              </div>
            </Card>
            </div>
            ) : null}
            <div style={{ border: `1px solid ${THEME.borderSoft}`, borderRadius: 6, padding: 12, background: THEME.panelAlt, color: THEME.muted, fontSize: 12 }}>Tip: Review your metrics, clean up ATS records, then generate your report. You can export or copy the report once it is ready.</div>
          </div>
        ) : null}

        {activePage === "reports" && reportsTab === "review-reports" ? (
          <div style={{ display: "grid", gap: 18 }}>
            <Card title="Audience Report Queue + Sender" subtitle="Select the report audience, then preview, copy, export, send, or mark selected reports complete." compact>
              <div style={{ display: "grid", gap: 14 }}>
                <div style={{ display: "grid", gap: 10, gridTemplateColumns: isNarrow ? "1fr" : "repeat(4, minmax(0, 1fr))" }}>
                  <Field label="Facility"><SelectInput value={selectedFacility} onChange={(event) => setSelectedFacility(event.target.value)} options={["All Facilities", "Facilities With Openings", "Facilities With No Openings", ...reportFacilityNames]} /></Field>
                  <Field label="Report Type"><SelectInput value={selectedReportType} onChange={(event) => setSelectedReportType(event.target.value)} options={reportTypeOptions} /></Field>
                  <Field label="Recipient Group"><SelectInput value={selectedRecipientGroup} onChange={(event) => setSelectedRecipientGroup(event.target.value)} options={recipientGroupOptions} /></Field>
                  <Field label="Status Filter"><SelectInput value={selectedStatusFilter} onChange={(event) => setSelectedStatusFilter(event.target.value)} options={reportStatusOptions} /></Field>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Button primary onClick={() => previewSelectedFacilityReports()} disabled={!selectedFacilityActionRows.length || !selectedFacilityActionEligibility.canCreateFinalPreview}>{previewSelectedReportsLabel(selectedFacilityActionRows.length)}</Button>
                  <Button subtle onClick={() => saveReportsToHistory(selectedFacilityActionRows, "Draft Generated")} disabled={!selectedFacilityActionRows.length}>Save Draft to History</Button>
                  <Button subtle onClick={copySelectedFacilityReports} disabled={!selectedFacilityActionRows.length || !selectedFacilityActionEligibility.canPrepareEmail}>Copy Email Body</Button>
                  <Button subtle onClick={exportSelectedFacilityReports} disabled={!selectedFacilityActionRows.length || !selectedFacilityActionEligibility.canDownloadWorkbook}>Download Combined Workbook</Button>
                  <Button subtle onClick={exportFacilityWorkbooks} disabled={!selectedFacilityActionRows.length || !selectedFacilityActionEligibility.canDownloadWorkbook}>Download Separate Facility Workbooks</Button>
                  <Button subtle onClick={markSelectedFacilityReportsReviewed} disabled={!allowManualCompletion || !selectedFacilityActionRows.length || !selectedFacilityActionEligibility.canMarkReady}>Mark Reviewed</Button>
                  <Button subtle onClick={markSelectedFacilityReportsSent} disabled={!selectedFacilityActionRows.length || !selectedFacilityActionEligibility.canPrepareEmail}>Mark Sent</Button>
                  <Button primary onClick={sendReadyFacilityReports} disabled={!selectedFacilityActionRows.length || !selectedFacilityActionEligibility.canPrepareEmail || !selectedFacilityActionEligibility.canMarkReady}>Review {selectedFacilityActionRows.length} Ready Reports</Button>
                </div>
                <Accordion title="Report Sections" subtitle="Choose what goes in the Excel attachment. Email stays concise." defaultOpen={false}>
                  <div style={{ display: "grid", gap: 8, gridTemplateColumns: isNarrow ? "1fr" : "repeat(3, minmax(0, 1fr))" }}>
                    {Object.entries(reportInclusions).map(([key, value]) => <ToggleField key={key} label={labelFromKey(key)} checked={Boolean(value)} onChange={(checked) => setReportInclusions((prev) => ({ ...prev, [key]: checked }))} />)}
                  </div>
                </Accordion>
                {reportIssueGroups.length ? <Card compact title="Reporting Issues" subtitle={`${selectedReportEligibility.blockingReasons.length} blocker${selectedReportEligibility.blockingReasons.length === 1 ? "" : "s"} in the selected scope. Diagnostic details remain available even when final output is blocked.`}><div style={{ display: "grid", gap: 8 }}>{reportIssueGroups.map((group) => <div key={group.code} style={{ border: `1px solid ${group.blocking ? THEME.red : THEME.amber}`, borderRadius: 6, background: group.blocking ? THEME.coralBg : THEME.amberBg }}><button type="button" aria-expanded={expandedReportIssueCode === group.code} onClick={() => setExpandedReportIssueCode((current) => current === group.code ? "" : group.code)} style={{ width: "100%", border: 0, background: "transparent", padding: 10, display: "flex", justifyContent: "space-between", gap: 10, color: THEME.text, fontWeight: 900, cursor: "pointer", textAlign: "left" }}><span>{group.label}</span><span>{group.count}</span></button>{expandedReportIssueCode === group.code ? <div style={{ display: "grid", gap: 7, padding: "0 10px 10px" }}>{group.issues.map((issue, index) => <div key={`${group.code}-${issue.identifier || issue.candidateId || issue.requisitionId || issue.facilityId}-${index}`} style={{ borderTop: `1px solid ${THEME.borderSoft}`, paddingTop: 8 }}><strong>{issue.facilityName || issue.originalFacilityLabel || "Unmapped Facility"}</strong><div style={{ color: THEME.muted, fontSize: 12 }}>{[issue.position, issue.requisitionNumber && `Req ${issue.requisitionNumber}`, issue.missingField].filter(Boolean).join(" | ") || issue.detail || issue.identifier}</div>{issue.originalFacilityLabel ? <div style={{ color: THEME.muted, fontSize: 12 }}>Original label: {issue.originalFacilityLabel}</div> : null}{issue.resolutionAction ? <div style={{ color: THEME.primary2, fontSize: 12, fontWeight: 850 }}>Next action: {issue.resolutionAction}</div> : null}</div>)}</div> : null}</div>)}</div></Card> : null}
                <div style={{ overflowX: "auto" }}>
                  <div style={{ minWidth: isNarrow ? 760 : 0, display: "grid", gap: 8 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "34px 1.2fr 120px 140px 1fr 90px", gap: 10, padding: "0 10px", color: THEME.muted, fontSize: 10, fontWeight: 900, textTransform: "uppercase" }}>
                      <span />
                      <span>Facility</span>
                      <span>Report</span>
                      <span>Status</span>
                      <span>Last Action</span>
                      <span>Action</span>
                    </div>
                    {facilityReportQueueFiltered.length ? facilityReportQueueFiltered.map((row) => (
                      <div key={row.id} style={{ display: "grid", gridTemplateColumns: "34px 1.2fr 120px 140px 1fr 90px", gap: 10, alignItems: "center", border: `1px solid ${selectedFacilityReports.includes(row.id) ? THEME.primary2 : THEME.borderSoft}`, borderRadius: 6, padding: 10, background: selectedFacilityReports.includes(row.id) ? THEME.blueBg : THEME.panel }}>
                        <input type="checkbox" checked={selectedFacilityReports.includes(row.id)} onChange={(event) => toggleFacilityReportSelection(row.id, event.target.checked)} aria-label={`Select ${row.facility} report`} />
                        <strong>{row.facility}</strong>
                        <span style={{ color: THEME.muted }}>{row.report}</span>
                        <Badge tone={row.status === "Missing Contact" ? "High" : row.status === "Needs Review" ? "Medium" : row.complete ? "Low" : "Interview"}>{LEGACY_REPORT_STATUS_DISPLAY[row.status] || row.status}</Badge>
                        <span style={{ color: THEME.muted }}>{row.lastAction}</span>
                        <Button subtle disabled={!eligibilityForReportRows([row]).canCreateFinalPreview} onClick={() => { setSelectedFacilityReports([row.id]); previewSelectedFacilityReports([row]); }} style={{ padding: "6px 8px", fontSize: 11 }}>{row.action}</Button>
                      </div>
                    )) : <EmptyState>No facility reports match this filter.</EmptyState>}
                  </div>
                </div>
              </div>
            </Card>
            <Card title="Weekly Report Preview" subtitle="Review Ready Reports loads the selected ready reports here without changing their status." compact action={<Button subtle onClick={copyWeeklyReport} disabled={!weeklyReport}>Copy Email Body</Button>}>
              <div style={{ border: `1px dashed ${THEME.border}`, borderRadius: 6, minHeight: 340, padding: 16, background: THEME.panelAlt, display: "grid", placeItems: weeklyReport ? "stretch" : "center" }}>
                {weeklyReport ? <EmailDocument title="Weekly Report" subject={weeklySubject} body={weeklyReport} attachmentLabel="Download Excel Workbook" onDownloadAttachment={exportSelectedFacilityReports} onMarkSent={markSelectedFacilityReportsSent} attachmentNotice="Mailto cannot attach the Excel file automatically. This downloads the report workbook so you can attach it to the email draft. After sending, use Mark Sent to document completion." /> : <div style={{ textAlign: "center", color: THEME.muted }}><div style={{ fontSize: 36, marginBottom: 10 }}> </div><strong style={{ color: THEME.text }}>Select reports and use Review Ready Reports to load them here.</strong></div>}
              </div>
            </Card>
          </div>
        ) : null}

        {activePage === "reports" && reportsTab === "facility-readiness" ? (
          <div style={{ display: "grid", gap: 18 }}>
            <Card title="Facility Readiness" subtitle={`${facilityReadinessStatusCounts["Needs Action"]} facilit${facilityReadinessStatusCounts["Needs Action"] === 1 ? "y needs" : "ies need"} action. Filters use AND behavior and selection remains explicit.`} compact>
              <div style={{ display: "grid", gap: 14 }}>
                <div style={{ border: `1px solid ${THEME.borderSoft}`, borderRadius: 8, padding: 12, background: THEME.panelAlt, display: "grid", gap: 10 }}>
                  <div>
                    <strong>No-opening facility policy</strong>
                    <div style={{ color: THEME.muted, fontSize: 12, marginTop: 3 }}>
                      Organization policy: {NO_OPENINGS_POLICY_OPTIONS.find((option) => option.value === noOpeningsPolicy)?.label}. {"\u201c"}Ask me each week{"\u201d"} choices are session-only and reset on reload.
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 8, gridTemplateColumns: isNarrow ? "1fr" : "minmax(260px, 1fr) auto", alignItems: "end" }}>
                    <Field label="Facilities with no active openings">
                      <SelectInput
                        value={noOpeningsPolicySelection}
                        onChange={(event) => setNoOpeningsPolicyDraft(event.target.value)}
                        options={NO_OPENINGS_POLICY_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                      />
                    </Field>
                    <Button primary onClick={saveNoOpeningsPolicy} disabled={Boolean(reportAutomation.noOpeningsPolicy) && (!noOpeningsPolicyDraft || noOpeningsPolicyDraft === noOpeningsPolicy)}>Save Policy</Button>
                  </div>
                  <div style={{ color: THEME.muted, fontSize: 12 }}>
                    {NO_OPENINGS_POLICY_OPTIONS.find((option) => option.value === noOpeningsPolicySelection)?.description}
                    {!reportAutomation.noOpeningsPolicy ? " This value is currently interpreted from existing settings and will not be written until Save Policy is selected." : ""}
                  </div>
                </div>
                <div style={{ border: `1px solid ${THEME.borderSoft}`, borderRadius: 999, height: 12, background: THEME.panelAlt, overflow: "hidden" }}>
                  <div style={{ width: `${reportCompletionSummary.total ? Math.round((reportCompletionSummary.done / reportCompletionSummary.total) * 100) : 0}%`, height: "100%", background: `linear-gradient(90deg, ${THEME.primary2}, ${THEME.green})` }} />
                </div>
                <div style={{ display: "grid", gap: 10, gridTemplateColumns: isNarrow ? "repeat(2, minmax(0, 1fr))" : "repeat(4, minmax(0, 1fr))" }}>
                  <MiniStat label="Needs Action" value={facilityReadinessStatusCounts["Needs Action"]} tone={facilityReadinessStatusCounts["Needs Action"] ? "High" : "Low"} compact />
                  <MiniStat label="Blocked" value={facilityReadinessStatusCounts.Blocked} tone={facilityReadinessStatusCounts.Blocked ? "High" : "Low"} compact />
                  <MiniStat label="Needs Review" value={facilityReadinessStatusCounts["Needs Review"]} tone={facilityReadinessStatusCounts["Needs Review"] ? "Medium" : "Low"} compact />
                  <MiniStat label="No Report Required" value={facilityReadinessStatusCounts["No Report Required"]} tone="Low" compact />
                </div>
                <div style={{ display: "grid", gap: 10, gridTemplateColumns: isNarrow ? "1fr" : "minmax(240px, 1.4fr) repeat(3, minmax(150px, 1fr))" }}>
                  <Field label="Search Facilities">
                    <TextInput
                      value={facilityReadinessFilters.search}
                      onChange={(event) => updateFacilityReadinessFilter("search", event.target.value)}
                      placeholder="Canonical name, alias, original label, or Facility ID"
                    />
                  </Field>
                  <Field label="Region">
                    <SelectInput value={facilityReadinessFilters.regionId} onChange={(event) => updateFacilityReadinessFilter("regionId", event.target.value)} options={[{ value: "All Regions", label: "All Regions" }, ...facilityReadinessRegions.map((region) => ({ value: region.id, label: region.name }))]} />
                  </Field>
                  <Field label="Readiness">
                    <SelectInput value={facilityReadinessFilters.readiness} onChange={(event) => updateFacilityReadinessFilter("readiness", event.target.value)} options={FACILITY_READINESS_OPTIONS} />
                  </Field>
                  <Field label="Report Type">
                    <SelectInput value={facilityReadinessFilters.reportType} onChange={(event) => updateFacilityReadinessFilter("reportType", event.target.value)} options={["All Report Types", ...Array.from(new Set(facilityReadinessRows.map((row) => row.reportType).filter(Boolean)))]} />
                  </Field>
                </div>
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                  {FACILITY_READINESS_OPTIONS.map((filter) => (
                    <button key={filter} type="button" onClick={() => updateFacilityReadinessFilter("readiness", filter)} style={{ border: `1px solid ${facilityReadinessFilters.readiness === filter ? THEME.primary2 : THEME.borderSoft}`, borderRadius: 999, padding: "7px 10px", background: facilityReadinessFilters.readiness === filter ? THEME.blueBg : THEME.panelAlt, color: facilityReadinessFilters.readiness === filter ? THEME.primary2 : THEME.muted, cursor: "pointer", fontWeight: 900, fontSize: 11 }}>
                      {filter} ({facilityReadinessStatusCounts[filter] ?? 0})
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <Button subtle onClick={selectAllVisibleFacilityReports} disabled={!facilityReadinessVisibleRows.length}>Select All Visible ({facilityReadinessVisibleRows.length})</Button>
                  <Button subtle onClick={selectAllMatchingFacilityReports} disabled={!facilityReadinessMatchingRows.length}>Select All Matching ({facilityReadinessMatchingRows.length})</Button>
                  <Button subtle onClick={clearFacilityReportSelection} disabled={!selectedFacilityReports.length}>Clear Selection</Button>
                  <span style={{ color: THEME.muted, fontSize: 12, fontWeight: 850 }}>
                    {facilityReadinessSelection.selectedCount} selected
                    {facilityReadinessSelection.hiddenSelectedCount ? `, ${facilityReadinessSelection.hiddenSelectedCount} hidden by current filters` : ""}
                  </span>
                </div>
                {facilityReadinessIssueGroups.length ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    {facilityReadinessIssueGroups.map((group) => (
                      <div key={group.code} style={{ border: `1px solid ${group.blocking ? THEME.red : THEME.amber}`, borderRadius: 7, background: group.blocking ? THEME.coralBg : THEME.amberBg }}>
                        <button type="button" aria-expanded={expandedReportIssueCode === group.code} onClick={() => setExpandedReportIssueCode((current) => current === group.code ? "" : group.code)} style={{ width: "100%", border: 0, background: "transparent", padding: 10, display: "flex", justifyContent: "space-between", gap: 10, color: THEME.text, fontWeight: 900, cursor: "pointer", textAlign: "left" }}>
                          <span>{group.label}</span><span>{group.count}</span>
                        </button>
                        {expandedReportIssueCode === group.code ? (
                          <div style={{ display: "grid", gap: 8, padding: "0 10px 10px" }}>
                            {group.issues.map((issue, index) => (
                              <div key={`${group.code}-${issue.identifier || issue.candidateId || issue.requisitionId || issue.facilityId}-${index}`} style={{ borderTop: `1px solid ${THEME.borderSoft}`, paddingTop: 9, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                                <div>
                                  <strong>{issue.facilityName || issue.originalFacilityLabel || "Unmapped Facility"}</strong>
                                  <div style={{ color: THEME.muted, fontSize: 12 }}>{[issue.position, issue.requisitionNumber && `Req ${issue.requisitionNumber}`, issue.missingField].filter(Boolean).join(" | ") || issue.detail || issue.identifier}</div>
                                  {issue.originalFacilityLabel ? <div style={{ color: THEME.muted, fontSize: 11 }}>Original label: {issue.originalFacilityLabel}</div> : null}
                                  {(issue.recordType || issue.identifier) ? <div style={{ color: THEME.muted, fontSize: 11 }}>Affected source: {[issue.recordType, issue.identifier].filter(Boolean).join(" ")}</div> : null}
                                  {issue.facilityIds?.length > 1 ? <div style={{ color: THEME.muted, fontSize: 11 }}>Canonical choices: {issue.facilityIds.join(", ")}</div> : null}
                                </div>
                                {issue.resolutionAction ? <Button subtle onClick={() => openReportingIssueCorrection(issue)}>{issue.resolutionAction}</Button> : null}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
                {selectedFacilityReports.length ? (
                  <div style={{ position: "sticky", top: 8, zIndex: 10, border: `1px solid ${THEME.primary2}`, borderRadius: 8, padding: 10, background: THEME.blueBg, boxShadow: THEME.shadow, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <strong>{facilityReadinessSelection.selectedCount} selected</strong>
                    {facilityReadinessSelection.hiddenSelectedCount ? <span style={{ color: THEME.muted }}>{facilityReadinessSelection.hiddenSelectedCount} hidden by current filters</span> : null}
                    {selectedFacilityPolicyRows.length !== selectedFacilityActionRows.length ? <span style={{ color: THEME.muted }}>{selectedFacilityPolicyRows.length - selectedFacilityActionRows.length} ineligible under the current policy</span> : null}
                    <Button primary onClick={() => previewSelectedFacilityReports()} disabled={!selectedFacilityActionRows.length || !selectedFacilityActionEligibility.canCreateFinalPreview}>{previewSelectedReportsLabel(selectedFacilityActionRows.length)}</Button>
                    <Button subtle onClick={exportSelectedFacilityReports} disabled={!selectedFacilityActionRows.length || !selectedFacilityActionEligibility.canDownloadWorkbook}>Download Combined Workbook</Button>
                    <Button subtle onClick={markSelectedFacilityReportsReviewed} disabled={!allowManualCompletion || !selectedFacilityActionRows.length || !selectedFacilityActionEligibility.canMarkReady}>Mark Reviewed</Button>
                    <Button subtle onClick={markSelectedFacilityReportsSent} disabled={!selectedFacilityActionRows.length || !selectedFacilityActionEligibility.canPrepareEmail}>Mark Sent</Button>
                    <Button subtle onClick={clearFacilityReportSelection}>Clear Selection</Button>
                  </div>
                ) : null}
                <div style={{ overflowX: "auto" }}>
                  <div style={{ minWidth: isNarrow ? 760 : 0, display: "grid", gap: 8 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "34px 1.3fr 110px 120px 1fr 180px", gap: 10, padding: "0 10px", color: THEME.muted, fontSize: 10, fontWeight: 900, textTransform: "uppercase" }}>
                      <span /><span>Facility</span><span>Report</span><span>Readiness</span><span>Last Action</span><span>Action</span>
                    </div>
                    {facilityReadinessVisibleRows.length ? facilityReadinessVisibleRows.map((row) => (
                      <div key={row.id} style={{ display: "grid", gridTemplateColumns: "34px 1.3fr 110px 120px 1fr 180px", gap: 10, alignItems: "center", border: `1px solid ${row.readiness === "Blocked" ? THEME.red : row.readiness === "Needs Review" ? THEME.amber : selectedFacilityReports.includes(row.id) ? THEME.primary2 : THEME.borderSoft}`, borderRadius: 6, padding: 10, background: selectedFacilityReports.includes(row.id) ? THEME.blueBg : THEME.panel }}>
                        <input type="checkbox" checked={selectedFacilityReports.includes(row.id)} onChange={(event) => toggleFacilityReportSelection(row.id, event.target.checked)} aria-label={`Select ${row.facility} readiness report`} />
                        <div><strong>{row.facility}</strong><div style={{ color: THEME.muted, fontSize: 11 }}>{[row.facilityId, row.regionName, row.originalFacilityLabel && row.originalFacilityLabel !== row.facility ? `Original: ${row.originalFacilityLabel}` : ""].filter(Boolean).join(" | ")}</div></div>
                        <span style={{ color: THEME.muted }}>{row.report}{row.noOpeningOutcomeLabel ? <><br /><strong style={{ color: row.readiness === "Blocked" ? THEME.red : row.readiness === "Needs Review" ? THEME.amber : THEME.green }}>{row.noOpeningOutcomeLabel}</strong></> : null}</span>
                        <Badge tone={row.readiness === "Blocked" ? "High" : row.readiness === "Needs Review" ? "Medium" : ["Ready", "Sent"].includes(row.readiness) ? "Low" : "Interview"}>{row.readiness}</Badge>
                        <span style={{ color: THEME.muted }}>{row.lastAction}</span>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {row.noOpeningOutcome?.applies && noOpeningsPolicy === NO_OPENINGS_POLICIES.ASK_WEEKLY && !noOpeningWeeklyDecisions[row.facilityId] ? <>
                            <Button subtle onClick={() => setWeeklyNoOpeningDecision(row.facilityId, NO_OPENINGS_WEEKLY_DECISIONS.CREATE_STANDARD_REPORT)} style={{ padding: "6px 8px", fontSize: 11 }}>Create Standard Report This Week</Button>
                            <Button subtle onClick={() => setWeeklyNoOpeningDecision(row.facilityId, NO_OPENINGS_WEEKLY_DECISIONS.NO_REPORT_NEEDED)} style={{ padding: "6px 8px", fontSize: 11 }}>No Report Needed This Week</Button>
                          </> : null}
                          {row.noOpeningOutcome?.applies && noOpeningsPolicy === NO_OPENINGS_POLICIES.ASK_WEEKLY && noOpeningWeeklyDecisions[row.facilityId] ? <Button subtle onClick={() => undoNoOpeningWeeklyDecision(row.facilityId)} style={{ padding: "6px 8px", fontSize: 11 }}>Undo Weekly Decision</Button> : null}
                          {row.readinessIssues.filter((issue) => issue.resolutionAction).slice(0, 2).map((issue, index) => <Button key={`${issue.code}-${issue.requisitionId || issue.facilityId}-${index}`} subtle onClick={() => openReportingIssueCorrection(issue)} style={{ padding: "6px 8px", fontSize: 11 }}>{issue.resolutionAction}</Button>)}
                          {!row.readinessIssues.some((issue) => issue.resolutionAction) && row.reportActionEligible !== false ? <Button subtle disabled={!eligibilityForReportRows([row]).canCreateFinalPreview} onClick={() => openReportReview(row)} style={{ padding: "6px 8px", fontSize: 11 }}>{row.action === "Preview" ? "Review Report" : row.action}</Button> : null}
                        </div>
                      </div>
                    )) : <EmptyState>No facilities match the current Needs Action filters.</EmptyState>}
                  </div>
                </div>
                {facilityReadinessVisibleRows.length < facilityReadinessMatchingRows.length ? <Button subtle onClick={() => setFacilityReadinessVisibleLimit((current) => current + 20)}>Show More ({facilityReadinessMatchingRows.length - facilityReadinessVisibleRows.length} remaining)</Button> : null}
                <div style={{ color: THEME.muted, fontSize: 12 }}>Showing {facilityReadinessVisibleRows.length} of {facilityReadinessMatchingRows.length} matching facilities. Filter changes preserve, but never add to, the current selection.</div>
              </div>
            </Card>
          </div>
        ) : null}

        {activePage === "reports" && reportsTab === "send-export" ? (
          <div style={{ display: "grid", gap: 18 }}>
            <WeeklyCleanupReportBuilder
              settings={settings}
              setSettings={setSettings}
              tracker={safeTrackerRows}
              hasLoaded={hasLoaded}
              loadError={/not ready|blocked|could not load/i.test(cloudStatus || "") ? cloudStatus : ""}
              reportStartDate={reportStartDate}
              reportEndDate={reportEndDate}
              generatedBy={settings.general?.recruiterName || ""}
              downloadExcelWorkbook={downloadExcelWorkbook}
            />
            <Card compact>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap", marginBottom: 16 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18 }}>Exports</h2>
                  <div style={{ color: THEME.muted, fontSize: 12, marginTop: 4 }}>Choose the export you need. Use the bulk export for your full weekly report and the individual exports for specific sections.</div>
                </div>
                <Badge tone="Interview">Exports include the latest data as of today.</Badge>
              </div>
              <div style={{ display: "grid", gap: 12, gridTemplateColumns: isNarrow ? "1fr" : isMedium ? "repeat(2, minmax(0, 1fr))" : "repeat(5, minmax(0, 1fr))" }}>
                {[
                  { title: "Download Combined Workbook", detail: "Download the complete weekly report with all sections and data.", action: exportWeeklyFullDataWorkbook, button: "Download Combined Workbook", icon: "", disabled: !selectedReportEligibility.canDownloadWorkbook, recommended: true, tone: THEME.primary2, bg: THEME.blueBg },
                  { title: "Download Separate Facility Workbooks", detail: "Download individual detailed Excel attachments by selected facility.", action: exportFacilityWorkbooks, button: "Download Separate Facility Workbooks", icon: "", tone: THEME.primary2, bg: THEME.blueBg },
                  { title: "Download Tracker CSV", detail: "Download candidate tracker data in CSV format.", action: exportTrackerCsv, button: "Download CSV", icon: "", tone: THEME.green, bg: THEME.greenBg },
                  { title: "Download History CSV", detail: "Download your weekly reporting history in CSV format.", action: exportHistoryCsv, button: "Download CSV", icon: "", disabled: !history.length, tone: THEME.primary2, bg: THEME.blueBg },
                  { title: "Download History Workbook", detail: "Download your weekly reporting history in Excel format.", action: exportHistoryExcel, button: "Download Excel Workbook", icon: "X", disabled: !history.length, tone: THEME.green, bg: THEME.greenBg },
                  { title: "Download JSON Backup", detail: "Back up all weekly reporting data in JSON format.", action: exportFullBackup, button: "Download JSON", icon: "{}", tone: THEME.primary2, bg: THEME.blueBg },
                ].map((item) => (
                  <div key={item.title} style={{ border: `1px solid ${item.recommended ? THEME.primary2 : THEME.borderSoft}`, borderRadius: 8, padding: 14, background: THEME.panel, display: "grid", gap: 12, alignContent: "space-between", minHeight: 216, boxShadow: item.recommended ? "0 12px 28px rgba(109,40,217,0.08)" : "none" }}>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" }}>
                        <span style={{ width: 36, height: 36, borderRadius: 8, display: "grid", placeItems: "center", background: item.bg, color: item.tone, fontWeight: 950 }}>{item.icon}</span>
                        {item.recommended ? <Badge tone="Interview">Recommended</Badge> : null}
                      </div>
                      <strong style={{ display: "block", marginTop: 18 }}>{item.title}</strong>
                      <div style={{ color: THEME.muted, fontSize: 12, lineHeight: 1.45, marginTop: 6 }}>{item.detail}</div>
                    </div>
                    <Button primary={item.recommended} subtle={!item.recommended} onClick={item.action} disabled={item.disabled} style={{ width: "100%" }}>{item.button}</Button>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16, border: `1px solid ${THEME.borderSoft}`, borderRadius: 8, padding: 14, background: THEME.panelAlt, display: "grid", gap: 12, gridTemplateColumns: isNarrow ? "1fr" : "1.2fr repeat(3, minmax(0, 1fr))", alignItems: "center" }}>
                <div><strong>Leader-Ready & Secure</strong><div style={{ color: THEME.muted, fontSize: 12, marginTop: 4 }}>All exports are formatted for leadership review and contain only the data you have access to.</div></div>
                <div style={{ color: THEME.muted, fontSize: 12 }}><strong style={{ color: THEME.green, display: "block" }}>Up to date</strong>Real-time data</div>
                <div style={{ color: THEME.muted, fontSize: 12 }}><strong style={{ color: THEME.primary2, display: "block" }}>Secure</strong>Role-based access</div>
                <div style={{ color: THEME.muted, fontSize: 12 }}><strong style={{ color: THEME.primary2, display: "block" }}>Private</strong>Your data only</div>
              </div>
            </Card>
          </div>
        ) : null}
    </>
  );
}
