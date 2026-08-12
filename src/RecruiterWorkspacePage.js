import React, { useEffect, useMemo, useState } from "react";
import {
  ACTION_CENTER_CATEGORIES,
  ACTION_CENTER_FILTERS,
  buildRecruiterActionCenter,
  filterRecruiterActionCenter,
} from "./actionCenterSelectors";
import {
  actionCenterItemSupportsCommunicationPreview,
  buildActionCenterCommunicationPreview,
} from "./actionCenterCommunicationPreviews";
import { buildRecruiterWorkspaceModel } from "./recruiterWorkspaceSelectors";
import { WORKSPACE_TASK_ACTIONS } from "./recruiterWorkspaceActions";
import { HomeCalendarWidget } from "./HomeCalendarWidget";

const FILTERS = ["Do Now", "Candidate Rescue", "Waiting on Others", "Offers", "Onboarding", "Recruiting Needed", "Stuck"];

function riskColor(level, theme) {
  if (level === "Critical" || level === "High") return { color: theme.red, background: theme.redBg };
  if (level === "Medium") return { color: theme.amber, background: theme.amberBg };
  return { color: theme.green, background: theme.greenBg };
}

function healthColor(status, theme) {
  if (status === "Critical" || status === "At Risk") return theme.red;
  if (status === "Needs Attention") return theme.amber;
  if (status === "Not enough data") return theme.muted;
  return theme.green;
}

function WorkspaceCard({ children, theme, title, subtitle, action }) {
  return (
    <section style={{ background: theme.panel, border: `1px solid ${theme.borderSoft}`, borderRadius: 10, padding: 14, boxShadow: theme.shadow }}>
      {title ? <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", marginBottom: 12 }}><div><h2 style={{ margin: 0, color: theme.text, fontSize: 16 }}>{title}</h2>{subtitle ? <p style={{ margin: "4px 0 0", color: theme.muted, fontSize: 12 }}>{subtitle}</p> : null}</div>{action}</div> : null}
      {children}
    </section>
  );
}

function CountButton({ label, value, detail, tone, onClick, theme }) {
  const colors = riskColor(tone, theme);
  return (
    <button type="button" onClick={onClick} style={{ border: `1px solid ${theme.borderSoft}`, borderRadius: 8, background: theme.panel, padding: 12, minHeight: 82, textAlign: "left", color: theme.text, cursor: "pointer", font: "inherit" }}>
      <strong style={{ display: "block", color: colors.color, fontSize: 22 }}>{value}</strong>
      <span style={{ display: "block", fontWeight: 900, fontSize: 12, marginTop: 2 }}>{label}</span>
      <span style={{ display: "block", color: theme.muted, fontSize: 11, marginTop: 3 }}>{detail}</span>
    </button>
  );
}

function QueueRow({ task, theme, narrow, onOpenCandidate, onOpenRequisition, onOpenCalendarEvent, onOpenActions }) {
  const colors = riskColor(task.riskLevel, theme);
  const primaryAction = task.sourceType === "candidate" ? onOpenCandidate : task.sourceType === "calendar" ? onOpenCalendarEvent : onOpenRequisition;
  const primaryLabel = task.sourceType === "candidate" ? "Open Candidate" : task.sourceType === "calendar" ? "View Event" : "Open Requisition";
  return (
    <article style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "minmax(190px, 1.2fr) minmax(210px, 1.5fr) 110px 125px 95px auto auto", gap: 10, alignItems: "center", border: `1px solid ${theme.borderSoft}`, borderLeft: `4px solid ${colors.color}`, borderRadius: 7, padding: 11, background: theme.panel }}>
      <div><strong style={{ display: "block" }}>{task.candidateName}</strong><span style={{ color: theme.muted, fontSize: 11 }}>{task.position} · {task.facilityName}</span></div>
      <div><span style={{ display: "block", color: theme.muted, fontSize: 10, fontWeight: 900, textTransform: "uppercase" }}>Why this is here</span><strong style={{ display: "block", fontSize: 12, lineHeight: 1.4 }}>{task.reason}</strong><span style={{ display: "block", color: theme.primary2, fontSize: 11, fontWeight: 850, marginTop: 4 }}>Next: {task.recommendedAction}</span></div>
      <span style={{ justifySelf: narrow ? "start" : "center", borderRadius: 999, padding: "4px 8px", color: colors.color, background: colors.background, fontSize: 11, fontWeight: 900 }}>{task.riskLevel}</span>
      <div><span style={{ display: "block", color: theme.muted, fontSize: 10, fontWeight: 900, textTransform: "uppercase" }}>Owner</span><strong style={{ fontSize: 12 }}>{task.ownerLabel}</strong></div>
      <div><span style={{ display: "block", color: theme.muted, fontSize: 10, fontWeight: 900, textTransform: "uppercase" }}>Timing</span><strong style={{ fontSize: 12 }}>{task.isOverdue ? "Overdue" : task.daysWaiting != null ? `${task.daysWaiting}d waiting` : "Current"}</strong><span style={{ display: "block", color: theme.muted, fontSize: 11 }}>{task.estimatedMinutes} min</span></div>
      <button type="button" onClick={() => primaryAction(task.sourceId, task.requisitionId, task)} style={{ border: `1px solid ${theme.primary2}`, borderRadius: 6, background: theme.panel, color: theme.primary2, padding: "8px 10px", fontWeight: 900, cursor: "pointer" }}>{primaryLabel}</button>
      {task.sourceType === "candidate" ? <button type="button" aria-label={`More actions for ${task.candidateName}`} onClick={() => onOpenActions(task)} style={{ border: `1px solid ${theme.borderSoft}`, borderRadius: 6, background: theme.panelAlt, color: theme.text, width: 34, height: 34, fontWeight: 950, cursor: "pointer" }}>⋯</button> : <span />}
    </article>
  );
}

const OWNER_OPTIONS = ["Recruiter", "Candidate", "Hiring Manager", "Regional Leader", "HR", "New Hire Liaison", "Background Team", "Credentialing", "Onboarding", "System or Requisition Issue"];

function WorkspaceTaskActionPanel({ task, theme, onClose, onApply, onScheduleCalendar }) {
  const [note, setNote] = useState("");
  const [ownerType, setOwnerType] = useState(task.ownerType || "Recruiter");
  const apply = (action, options = {}) => {
    if (onApply(task, action, { note, ownerType, ...options }) !== false) onClose();
  };
  return (
    <section aria-label={`Task actions for ${task.candidateName}`} style={{ border: `1px solid ${theme.primary2}`, borderRadius: 8, padding: 12, background: theme.blueBg || theme.panelAlt, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}><div><strong>{task.candidateName}</strong><div style={{ color: theme.muted, fontSize: 11 }}>{task.reason}</div></div><button type="button" onClick={onClose} aria-label="Close task actions" style={{ border: 0, background: "transparent", color: theme.text, cursor: "pointer", fontWeight: 950 }}>×</button></div>
      <label style={{ display: "grid", gap: 4, color: theme.muted, fontSize: 11, fontWeight: 850 }}>Update or resolution note<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} placeholder="Record what changed or why the action is resolved." style={{ border: `1px solid ${theme.borderSoft}`, borderRadius: 6, padding: 8, color: theme.text, background: theme.panel, font: "inherit", resize: "vertical" }} /></label>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 1fr) auto", gap: 8, alignItems: "end" }}><label style={{ display: "grid", gap: 4, color: theme.muted, fontSize: 11, fontWeight: 850 }}>Current next-step owner<select value={ownerType} onChange={(event) => setOwnerType(event.target.value)} style={{ border: `1px solid ${theme.borderSoft}`, borderRadius: 6, padding: 8, color: theme.text, background: theme.panel }}>{OWNER_OPTIONS.map((owner) => <option key={owner}>{owner}</option>)}</select></label><button type="button" onClick={() => apply(WORKSPACE_TASK_ACTIONS.REASSIGN)} style={{ border: `1px solid ${theme.borderSoft}`, borderRadius: 6, padding: "8px 10px", background: theme.panel, color: theme.text, fontWeight: 850, cursor: "pointer" }}>Change Owner</button></div>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
        <button type="button" onClick={() => apply(WORKSPACE_TASK_ACTIONS.FOLLOW_UP)} style={{ border: 0, borderRadius: 6, padding: "8px 10px", background: theme.primary2, color: "#fff", fontWeight: 850, cursor: "pointer" }}>Log Follow-Up</button>
        <button type="button" onClick={() => apply(WORKSPACE_TASK_ACTIONS.ESCALATE)} style={{ border: `1px solid ${theme.red}`, borderRadius: 6, padding: "8px 10px", background: theme.redBg, color: theme.red, fontWeight: 850, cursor: "pointer" }}>Escalate</button>
        <button type="button" onClick={() => apply(WORKSPACE_TASK_ACTIONS.SNOOZE, { snoozeDays: 1 })} style={{ border: `1px solid ${theme.borderSoft}`, borderRadius: 6, padding: "8px 10px", background: theme.panel, color: theme.text, fontWeight: 850, cursor: "pointer" }}>Snooze 1 Day</button>
        <button type="button" onClick={() => apply(WORKSPACE_TASK_ACTIONS.ADD_UPDATE)} disabled={!note.trim()} style={{ border: `1px solid ${theme.borderSoft}`, borderRadius: 6, padding: "8px 10px", background: theme.panel, color: theme.text, fontWeight: 850, cursor: note.trim() ? "pointer" : "not-allowed", opacity: note.trim() ? 1 : 0.55 }}>Add Update</button>
        <button type="button" onClick={() => onScheduleCalendar(task)} style={{ border: `1px solid ${theme.primary2}`, borderRadius: 6, padding: "8px 10px", background: theme.panel, color: theme.primary2, fontWeight: 850, cursor: "pointer" }}>Schedule Follow-Up</button>
        {task.filters.includes("Candidate Rescue") ? <button type="button" onClick={() => apply(WORKSPACE_TASK_ACTIONS.NOT_AT_RISK)} style={{ border: `1px solid ${theme.green}`, borderRadius: 6, padding: "8px 10px", background: theme.greenBg, color: theme.green, fontWeight: 850, cursor: "pointer" }}>Mark Not At Risk</button> : null}
        <button type="button" onClick={() => apply(WORKSPACE_TASK_ACTIONS.RESOLVE)} style={{ border: `1px solid ${theme.green}`, borderRadius: 6, padding: "8px 10px", background: theme.greenBg, color: theme.green, fontWeight: 850, cursor: "pointer" }}>Mark Resolved</button>
      </div>
    </section>
  );
}

function EmptyQueue({ filter, waitingCount, focusTask, theme }) {
  const message = filter === "Do Now"
    ? "You have no urgent recruiter-owned tasks."
    : filter === "Waiting on Others" && waitingCount
      ? `${waitingCount} items are waiting on other owners.`
      : filter === "Recruiting Needed" && focusTask
        ? `Your recommended recruiting focus is ${focusTask.position} at ${focusTask.facilityName}.`
        : `No ${filter.toLowerCase()} items need attention right now.`;
  return <div style={{ border: `1px dashed ${theme.borderSoft}`, borderRadius: 8, padding: 20, color: theme.muted, textAlign: "center" }}>{message}</div>;
}

function ActionCenterRow({ item, theme, narrow, onReview, onOpen }) {
  const colors = riskColor(item.riskLevel, theme);
  return (
    <article style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "minmax(210px, 1.1fr) minmax(260px, 1.7fr) 110px auto auto", gap: 10, alignItems: "center", border: `1px solid ${theme.borderSoft}`, borderLeft: `4px solid ${colors.color}`, borderRadius: 7, padding: 11, background: theme.panel }}>
      <div>
        <strong style={{ display: "block" }}>{item.title}</strong>
        <span style={{ color: theme.muted, fontSize: 11 }}>{[item.context.requisition, item.context.facility].filter(Boolean).join(" | ") || item.sourceType}</span>
      </div>
      <div>
        <span style={{ display: "block", color: theme.muted, fontSize: 10, fontWeight: 900, textTransform: "uppercase" }}>Why this needs attention</span>
        <strong style={{ display: "block", fontSize: 12, lineHeight: 1.4 }}>{item.explanation}</strong>
        <span style={{ display: "block", color: theme.primary2, fontSize: 11, fontWeight: 850, marginTop: 4 }}>Next: {item.recommendedAction}</span>
      </div>
      <span style={{ justifySelf: narrow ? "start" : "center", borderRadius: 999, padding: "4px 8px", color: colors.color, background: colors.background, fontSize: 11, fontWeight: 900 }}>{item.riskLevel}</span>
      <button type="button" aria-label={`Review details for ${item.title}`} onClick={() => onReview(item.id)} style={{ border: `1px solid ${theme.borderSoft}`, borderRadius: 6, background: theme.panelAlt, color: theme.text, padding: "8px 10px", fontWeight: 850, cursor: "pointer" }}>Review Details</button>
      <button type="button" disabled={Boolean(item.destination.disabled)} title={item.destination.reason || ""} onClick={() => onOpen(item)} style={{ border: `1px solid ${theme.primary2}`, borderRadius: 6, background: theme.panel, color: theme.primary2, padding: "8px 10px", fontWeight: 900, cursor: item.destination.disabled ? "not-allowed" : "pointer", opacity: item.destination.disabled ? 0.55 : 1 }}>{item.destination.label}</button>
    </article>
  );
}

function ActionCenterDetail({ item, theme, onClose, onOpen, onPreviewCommunication }) {
  const context = [
    ["Candidate", item.context.candidate],
    ["Candidate ID", item.context.candidateId],
    ["Requisition", item.context.requisition],
    ["Requisition ID", item.context.requisitionId],
    ["Req Number", item.context.requisitionNumber],
    ["Facility", item.context.facility],
    ["Facility ID", item.context.facilityId],
    ["Region", item.context.region],
    ["Current owner", item.context.currentOwner],
    ["Due", item.dueAt],
  ].filter(([, value]) => value);
  return (
    <section aria-label={`Action details for ${item.title}`} style={{ border: `2px solid ${theme.primary2}`, borderRadius: 8, padding: 12, background: theme.blueBg || theme.panelAlt, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
        <div><strong>{item.title}</strong><div style={{ color: theme.muted, fontSize: 11, marginTop: 3 }}>{item.explanation}</div></div>
        <button type="button" onClick={onClose} aria-label="Close Action Center details" style={{ border: 0, background: "transparent", color: theme.text, cursor: "pointer", fontWeight: 950 }}>×</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 7 }}>
        {context.map(([label, value]) => <div key={label} style={{ border: `1px solid ${theme.borderSoft}`, borderRadius: 6, padding: 8, background: theme.panel }}><span style={{ display: "block", color: theme.muted, fontSize: 10, fontWeight: 900, textTransform: "uppercase" }}>{label}</span><strong style={{ display: "block", fontSize: 12, marginTop: 2 }}>{value}</strong></div>)}
      </div>
      {item.missingData.length ? <div role="status" style={{ color: theme.red, fontSize: 12, fontWeight: 850 }}>Correction required: {item.missingData.join(", ")}.</div> : null}
      <div style={{ border: `1px solid ${theme.borderSoft}`, borderRadius: 6, padding: 9, background: theme.panel, color: theme.muted, fontSize: 11 }}>
        <strong style={{ color: theme.green }}>Read-only preview.</strong> Opening or reviewing this item changes no candidate, requisition, facility, report, communication, or history record. {item.approvalRequired}
      </div>
      {item.destination.disabled ? <div role="status" style={{ color: theme.red, fontSize: 12, fontWeight: 850 }}>{item.destination.reason}</div> : null}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {actionCenterItemSupportsCommunicationPreview(item) ? <button type="button" onClick={() => onPreviewCommunication(item)} style={{ border: 0, borderRadius: 6, background: theme.primary2, color: "#fff", padding: "8px 11px", fontWeight: 900, cursor: "pointer" }}>Preview Communication</button> : null}
        <button type="button" disabled={Boolean(item.destination.disabled)} title={item.destination.reason || ""} onClick={() => onOpen(item)} style={{ border: `1px solid ${theme.primary2}`, borderRadius: 6, background: theme.panel, color: theme.primary2, padding: "8px 11px", fontWeight: 900, cursor: item.destination.disabled ? "not-allowed" : "pointer", opacity: item.destination.disabled ? 0.55 : 1 }}>{item.destination.label}</button>
      </div>
    </section>
  );
}

function ActionCenterCommunicationPreviewDialog({ preview, theme, onClose }) {
  const context = [
    ["Candidate", preview.context.candidate],
    ["Candidate ID", preview.context.candidateId],
    ["Requisition", preview.context.requisition],
    ["Requisition ID", preview.context.requisitionId],
    ["Req Number", preview.context.requisitionNumber],
    ["Facility", preview.context.facility],
    ["Facility ID", preview.context.facilityId],
    ["Region", preview.context.region],
  ].filter(([, value]) => value);
  return (
    <div role="dialog" aria-modal="true" aria-label={preview.title} onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 140, background: "rgba(16, 10, 43, 0.62)", display: "grid", placeItems: "center", padding: 16 }}>
      <div onClick={(event) => event.stopPropagation()} style={{ width: "min(980px, 100%)", maxHeight: "92vh", overflow: "auto", border: `1px solid ${theme.borderSoft}`, borderRadius: 10, background: theme.panel, color: theme.text, boxShadow: theme.shadow, display: "grid" }}>
        <header style={{ position: "sticky", top: 0, zIndex: 1, borderBottom: `1px solid ${theme.borderSoft}`, padding: 14, background: theme.panel, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div><div style={{ color: theme.primary2, fontSize: 11, fontWeight: 950, textTransform: "uppercase" }}>Read-only communication preview</div><h2 style={{ margin: "4px 0", fontSize: 19 }}>{preview.title}</h2><div style={{ color: theme.muted, fontSize: 12 }}>Nothing can be copied, opened, sent, saved, or marked complete from this preview.</div></div>
          <button type="button" onClick={onClose} aria-label={`Close ${preview.title}`} style={{ border: `1px solid ${theme.borderSoft}`, borderRadius: 6, background: theme.panelAlt, color: theme.text, padding: "7px 10px", fontWeight: 900, cursor: "pointer" }}>Close</button>
        </header>
        <div style={{ padding: 14, display: "grid", gap: 12 }}>
          <section aria-label="Resolved communication context" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 7 }}>
            {context.map(([label, value]) => <div key={label} style={{ border: `1px solid ${theme.borderSoft}`, borderRadius: 6, padding: 8, background: theme.panelAlt }}><span style={{ display: "block", color: theme.muted, fontSize: 10, fontWeight: 900, textTransform: "uppercase" }}>{label}</span><strong style={{ display: "block", marginTop: 2, fontSize: 12, overflowWrap: "anywhere" }}>{value}</strong></div>)}
          </section>
          <section style={{ border: `1px solid ${preview.blockers.length ? theme.red : theme.green}`, borderRadius: 7, padding: 10, background: preview.blockers.length ? theme.redBg : theme.greenBg }}>
            <strong style={{ color: preview.blockers.length ? theme.red : theme.green }}>{preview.blockers.length ? "Preview blocked" : "Context resolved"}</strong>
            <div style={{ marginTop: 4, color: theme.text, fontSize: 12 }}>{preview.explanation || "The exact Action Center context has been resolved for review."}</div>
            {preview.blockers.length ? <div role="status" style={{ display: "grid", gap: 5, marginTop: 8 }}>{preview.blockers.map((blocker) => <div key={`${blocker.code}-${blocker.message}`} style={{ fontSize: 12 }}><strong>{blocker.code}:</strong> {blocker.message}</div>)}</div> : null}
          </section>
          {preview.documents.map((entry) => <section key={entry.key} aria-label={entry.title} style={{ border: `1px solid ${theme.borderSoft}`, borderRadius: 8, overflow: "hidden", background: theme.panel }}>
            <div style={{ padding: 10, background: theme.panelAlt, borderBottom: `1px solid ${theme.borderSoft}`, display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><strong>{entry.title}</strong><span style={{ color: theme.muted, fontSize: 11 }}>{entry.channel}{entry.templateKey ? ` | ${entry.templateKey}${entry.templateVariant ? ` | ${entry.templateVariant}` : ""}` : ""}</span></div>
            <div style={{ padding: 11, display: "grid", gap: 7, fontSize: 12 }}>
              <div><strong>Recipient:</strong> <span style={{ color: theme.muted }}>{entry.recipientLabel}</span></div>
              {entry.to.length ? <div><strong>To:</strong> <span style={{ color: theme.muted }}>{entry.to.join("; ")}</span></div> : null}
              {entry.cc.length ? <div><strong>CC:</strong> <span style={{ color: theme.muted }}>{entry.cc.join("; ")}</span></div> : null}
              {entry.subject ? <div><strong>Subject:</strong> <span style={{ color: theme.muted }}>{entry.subject}</span></div> : null}
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "Inter, Arial, sans-serif", fontSize: 12.5, lineHeight: 1.55, border: `1px solid ${theme.borderSoft}`, borderRadius: 6, background: theme.panelAlt, padding: 11 }}>{entry.body || "No preview content available."}</pre>
            </div>
          </section>)}
          <div style={{ color: theme.muted, fontSize: 11 }}>Snapshot: <strong style={{ color: theme.text }}>{preview.snapshotHash}</strong>. Close this preview to return without changing any record.</div>
        </div>
      </div>
    </div>
  );
}

export function RecruiterWorkspacePage({ tracker = [], requisitions = [], actionCenterRequisitions = null, sites = [], history = [], calendarEvents = [], workflowRules = {}, communicationSettings = {}, theme, isNarrow = false, isMedium = false, recruiterName = "Recruiter", onOpenCandidate, onOpenActionCenterCandidate = onOpenCandidate, onOpenRequisition, onOpenActionCenterRequisition = onOpenRequisition, onOpenFacility = onOpenRequisition, onOpenActionCenterFacility = onOpenFacility, onOpenCalendar = () => {}, onOpenCalendarEvent = () => {}, onAddCalendarEvent = () => {}, onScheduleCalendar = () => {}, onOpenWeeklyCleanup, onOpenReports, onTaskAction = () => true, onWorkspaceEvent = () => true }) {
  const [activeFilter, setActiveFilter] = useState("Do Now");
  const [actionTaskId, setActionTaskId] = useState("");
  const [focusMode, setFocusMode] = useState(false);
  const [focusStartedAt, setFocusStartedAt] = useState("");
  const [readinessExpanded, setReadinessExpanded] = useState(false);
  const [wrapUpOpen, setWrapUpOpen] = useState(false);
  const [actionCenterFilter, setActionCenterFilter] = useState(ACTION_CENTER_CATEGORIES.all);
  const [actionCenterDetailId, setActionCenterDetailId] = useState("");
  const [actionCenterCommunicationPreviewId, setActionCenterCommunicationPreviewId] = useState("");
  const [actionCenterNow, setActionCenterNow] = useState(() => new Date());
  const completeActionCenterRequisitions = Array.isArray(actionCenterRequisitions) ? actionCenterRequisitions : requisitions;
  const model = useMemo(() => buildRecruiterWorkspaceModel({ tracker, requisitions, sites, history, calendarEvents, rules: workflowRules }), [tracker, requisitions, sites, history, calendarEvents, workflowRules]);
  const actionCenter = useMemo(() => buildRecruiterActionCenter({ tracker, requisitions: completeActionCenterRequisitions, sites, history, calendarEvents, workflowRules, now: actionCenterNow }), [tracker, completeActionCenterRequisitions, sites, history, calendarEvents, workflowRules, actionCenterNow]);
  useEffect(() => {
    const transitionAt = Date.parse(actionCenter.nextRefreshAt);
    if (!Number.isFinite(transitionAt)) return undefined;
    const maximumDelay = 2147483647;
    const delay = Math.min(maximumDelay, Math.max(0, transitionAt - Date.now()));
    const timer = window.setTimeout(() => setActionCenterNow(new Date()), delay);
    return () => window.clearTimeout(timer);
  }, [actionCenter.nextRefreshAt, actionCenterNow]);
  const actionCenterItems = useMemo(() => filterRecruiterActionCenter(actionCenter.items, actionCenterFilter), [actionCenter.items, actionCenterFilter]);
  const actionCenterDetail = actionCenter.items.find((item) => item.id === actionCenterDetailId) || null;
  const actionCenterCommunicationItem = actionCenter.items.find((item) => item.id === actionCenterCommunicationPreviewId) || null;
  const actionCenterCommunicationPreview = useMemo(() => actionCenterCommunicationItem ? buildActionCenterCommunicationPreview({
    item: actionCenterCommunicationItem,
    tracker,
    requisitions: completeActionCenterRequisitions,
    sites,
    settings: communicationSettings,
  }) : null, [actionCenterCommunicationItem, tracker, completeActionCenterRequisitions, sites, communicationSettings]);
  const openActionCenterItem = (item) => {
    if (item.destination.disabled) return;
    if (item.destination.type === "candidate") onOpenActionCenterCandidate(item.destination.id, item.requisitionId, item);
    else if (item.destination.type === "requisition") onOpenActionCenterRequisition(item.destination.id, item);
    else if (item.destination.type === "facility") onOpenActionCenterFacility(item.destination.id, item);
    else if (item.destination.type === "calendar") onOpenCalendarEvent(item.destination.id);
    else onOpenWeeklyCleanup();
  };
  const filteredTasks = useMemo(() => activeFilter === "Urgent"
    ? model.tasks.filter((task) => task.isOverdue || ["High", "Critical"].includes(task.riskLevel))
    : model.tasks.filter((task) => task.filters.includes(activeFilter)), [model.tasks, activeFilter]);
  const taskCount = (filter) => model.tasks.filter((task) => task.filters.includes(filter)).length;
  const setQueueFilter = (filter) => setActiveFilter(filter);
  const actionTask = model.tasks.find((task) => task.id === actionTaskId) || null;
  const planItems = [
    { label: "Rescue candidates at risk", value: model.plan.rescue, detail: "High or critical risk", tone: model.plan.rescue ? "High" : "Low", filter: "Candidate Rescue" },
    { label: "Follow up on overdue decisions", value: model.plan.overdueDecisions, detail: "Waiting on another owner", tone: model.plan.overdueDecisions ? "Medium" : "Low", filter: "Waiting on Others" },
    { label: "Complete submissions", value: model.plan.submissions, detail: "Recruiter-owned next steps", tone: model.plan.submissions ? "Medium" : "Low", filter: "Do Now" },
    { label: "Check in on new hires", value: model.plan.newHireCheckIns, detail: "Offer and onboarding care", tone: model.plan.newHireCheckIns ? "Medium" : "Low", filter: "Onboarding" },
    { label: "Protect recruiting time", value: `${model.plan.focusMinutes}m`, detail: model.focusTask ? "Priority requisition identified" : "No sourcing gap detected", tone: model.focusTask ? "Medium" : "Low", filter: "Recruiting Needed" },
  ];
  const healthLabels = {
    candidateFollowUp: "Candidate Follow-Up",
    hiringManagerResponse: "Hiring Manager Response",
    sourcingCoverage: "Sourcing Coverage",
    offerProcess: "Offer Process",
    newHireCare: "New Hire Care",
    reportingReadiness: "Reporting Readiness",
  };
  const startFocusSession = () => {
    setFocusStartedAt(new Date().toISOString());
    setFocusMode(true);
    setQueueFilter("Recruiting Needed");
  };
  const finishFocusSession = () => {
    const finishedAt = new Date();
    const startedAt = focusStartedAt ? new Date(focusStartedAt) : finishedAt;
    const minutes = Math.max(1, Math.round((finishedAt.getTime() - startedAt.getTime()) / 60000));
    onWorkspaceEvent({
      type: "Recruiting Focus Session Completed",
      subject: model.focusTask?.position || "Recruiting focus",
      body: `${minutes} focused recruiting minute${minutes === 1 ? "" : "s"} completed for ${model.focusTask?.facilityName || "the priority requisition"}.`,
      meta: { minutes, requisitionId: model.focusTask?.requisitionId || "", source: "Recruiter Workspace" },
    });
    setFocusStartedAt("");
    setFocusMode(false);
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div><h1 style={{ margin: 0, color: theme.text, fontSize: 24, fontWeight: 950 }}>⚡ Recruiter Workspace</h1><p style={{ margin: "4px 0 0", color: theme.muted, fontSize: 12 }}>{focusMode ? "Focus Mode keeps the priority requisition and essential work visible." : "Your command center for today’s recruiting priorities"}</p></div>
        <div style={{ display: "flex", gap: 8 }}>
          {focusMode ? <button type="button" onClick={finishFocusSession} style={{ border: 0, borderRadius: 6, background: theme.primary2, color: "#fff", padding: "9px 12px", fontWeight: 850, cursor: "pointer" }}>Finish Focus Session</button> : <button type="button" onClick={() => setWrapUpOpen(true)} style={{ border: `1px solid ${theme.primary2}`, borderRadius: 6, background: theme.panel, color: theme.primary2, padding: "9px 12px", fontWeight: 850, cursor: "pointer" }}>Wrap Up My Day</button>}
          {focusMode ? <button type="button" onClick={() => { setFocusStartedAt(""); setFocusMode(false); }} style={{ border: `1px solid ${theme.borderSoft}`, borderRadius: 6, background: theme.panel, color: theme.text, padding: "9px 12px", fontWeight: 850, cursor: "pointer" }}>Exit Without Completing</button> : null}
          <button type="button" onClick={onOpenReports} style={{ border: `1px solid ${theme.borderSoft}`, borderRadius: 6, background: theme.panel, color: theme.text, padding: "9px 12px", fontWeight: 850, cursor: "pointer" }}>Preview Report</button>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: focusMode || isMedium ? "1fr" : "minmax(0, 1fr) 280px", gap: 14, alignItems: "start" }}>
        <main style={{ display: "grid", gap: 14 }}>
          {!focusMode ? <WorkspaceCard theme={theme} title="Today’s Plan" subtitle={`Good morning, ${recruiterName}. A focused plan based on current workflow records.`}>
            <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "repeat(2, minmax(0, 1fr))" : "repeat(5, minmax(0, 1fr))", gap: 8 }}>
              {planItems.map((item) => <CountButton key={item.label} {...item} onClick={() => setQueueFilter(item.filter)} theme={theme} />)}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              <button type="button" onClick={() => setQueueFilter("Do Now")} style={{ border: 0, borderRadius: 6, background: theme.primary2, color: "#fff", padding: "9px 14px", fontWeight: 900, cursor: "pointer" }}>Start My Day</button>
              <button type="button" onClick={() => setQueueFilter("Waiting on Others")} style={{ border: `1px solid ${theme.borderSoft}`, borderRadius: 6, background: theme.panel, color: theme.text, padding: "9px 14px", fontWeight: 900, cursor: "pointer" }}>Review Waiting Items</button>
            </div>
          </WorkspaceCard> : null}

          {model.focusTask ? <WorkspaceCard theme={theme} title={focusMode ? "Recruiting Focus Session" : "Recruiting Focus"} subtitle="The current highest-priority requisition based on openings, candidate coverage, and days without submissions.">
            <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "1.4fr repeat(3, minmax(90px, 0.7fr)) auto", gap: 10, alignItems: "center" }}><div><strong style={{ display: "block" }}>{model.focusTask.position}</strong><span style={{ color: theme.muted, fontSize: 12 }}>{model.focusTask.facilityName}</span><span style={{ display: "block", color: theme.red, fontSize: 11, marginTop: 4 }}>{model.focusTask.riskReason}</span><span style={{ display: "block", color: theme.muted, fontSize: 10, marginTop: 4 }}>Priority {model.focusTask.priorityScore}: {model.focusTask.priorityReasons.join(" · ")}</span></div><div><strong>{model.focusTask.openings}</strong><span style={{ display: "block", color: theme.muted, fontSize: 11 }}>Openings</span></div><div><strong>{model.focusTask.activeCandidateCount}</strong><span style={{ display: "block", color: theme.muted, fontSize: 11 }}>Active candidates</span></div><div><strong>{model.focusTask.daysWaiting ?? "—"}</strong><span style={{ display: "block", color: theme.muted, fontSize: 11 }}>Days without submission</span></div>{focusMode ? <strong style={{ color: theme.primary2, fontSize: 12 }}>Focus session active</strong> : <button type="button" onClick={startFocusSession} style={{ border: 0, borderRadius: 6, background: theme.primary2, color: "#fff", padding: "9px 12px", fontWeight: 900, cursor: "pointer" }}>Start Focus Session</button>}</div>
            {focusMode ? <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "repeat(4, minmax(0, 1fr))", gap: 8, marginTop: 12 }}>{[["Shift", model.focusTask.shift || "Not listed"], ["Employment", model.focusTask.employmentType || "Not listed"], ["Schedule", model.focusTask.schedule || "Not listed"], ["Credentials / Pay", [model.focusTask.requiredCredentials, model.focusTask.pay].filter(Boolean).join(" · ") || "Review requisition"]].map(([label, value]) => <div key={label} style={{ border: `1px solid ${theme.borderSoft}`, borderRadius: 6, padding: 9, background: theme.panelAlt }}><span style={{ color: theme.muted, fontSize: 10, fontWeight: 900 }}>{label}</span><strong style={{ display: "block", fontSize: 12, marginTop: 3 }}>{value}</strong></div>)}</div> : null}
          </WorkspaceCard> : null}

          {!focusMode ? <WorkspaceCard theme={theme} title="Recruiter Action Center" subtitle="Read-only priorities explain what needs attention, why it matters, and the exact record to review.">
            <div role="tablist" aria-label="Action Center filters" style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 12 }}>
              {ACTION_CENTER_FILTERS.map((filter) => <button key={filter} type="button" role="tab" aria-selected={actionCenterFilter === filter} onClick={() => { setActionCenterFilter(filter); setActionCenterDetailId(""); }} style={{ border: `1px solid ${actionCenterFilter === filter ? theme.primary2 : theme.borderSoft}`, borderRadius: 6, background: actionCenterFilter === filter ? theme.primary2 : theme.panelAlt, color: actionCenterFilter === filter ? "#fff" : theme.text, padding: "7px 10px", fontWeight: 850, cursor: "pointer" }}>{filter} <span aria-label={`${actionCenter.counts[filter]} items`}>{actionCenter.counts[filter]}</span></button>)}
            </div>
            <div role="tabpanel" aria-label={`${actionCenterFilter} Action Center items`} style={{ display: "grid", gap: 8 }}>
              {actionCenterItems.length ? actionCenterItems.map((item) => <ActionCenterRow key={item.id} item={item} theme={theme} narrow={isNarrow} onReview={setActionCenterDetailId} onOpen={openActionCenterItem} />) : <div style={{ border: `1px dashed ${theme.borderSoft}`, borderRadius: 8, padding: 20, color: theme.muted, textAlign: "center" }}>No {actionCenterFilter === ACTION_CENTER_CATEGORIES.all ? "Action Center" : actionCenterFilter.toLowerCase()} items need attention right now.</div>}
              {actionCenterDetail ? <ActionCenterDetail item={actionCenterDetail} theme={theme} onClose={() => setActionCenterDetailId("")} onOpen={openActionCenterItem} onPreviewCommunication={(item) => setActionCenterCommunicationPreviewId(item.id)} /> : null}
            </div>
            {actionCenterCommunicationPreview ? <ActionCenterCommunicationPreviewDialog preview={actionCenterCommunicationPreview} theme={theme} onClose={() => setActionCenterCommunicationPreviewId("")} /> : null}
          </WorkspaceCard> : null}

          <WorkspaceCard theme={theme} title="My Work Queue" subtitle="Every item explains its source, owner, timing, and recommended next step.">
            <div role="tablist" aria-label="Work queue filters" style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 12 }}>
              {FILTERS.map((filter) => <button key={filter} type="button" role="tab" aria-selected={activeFilter === filter} onClick={() => setQueueFilter(filter)} style={{ border: `1px solid ${activeFilter === filter ? theme.primary2 : theme.borderSoft}`, borderRadius: 6, background: activeFilter === filter ? theme.primary2 : theme.panelAlt, color: activeFilter === filter ? "#fff" : theme.text, padding: "7px 10px", fontWeight: 850, cursor: "pointer" }}>{filter} <span aria-label={`${taskCount(filter)} items`}>{taskCount(filter)}</span></button>)}
            </div>
            {activeFilter === "Urgent" ? <div style={{ color: theme.primary2, fontSize: 12, fontWeight: 900, marginBottom: 10 }}>Showing: Urgent Actions</div> : null}
            <div role="tabpanel" style={{ display: "grid", gap: 8 }}>
              {filteredTasks.length ? filteredTasks.map((task) => <QueueRow key={task.id} task={task} theme={theme} narrow={isNarrow} onOpenCandidate={onOpenCandidate} onOpenRequisition={onOpenRequisition} onOpenCalendarEvent={onOpenCalendarEvent} onOpenActions={(selectedTask) => setActionTaskId(selectedTask.id)} />) : <EmptyQueue filter={activeFilter} waitingCount={model.snapshot.waiting} focusTask={model.focusTask} theme={theme} />}
              {actionTask ? <WorkspaceTaskActionPanel task={actionTask} theme={theme} onClose={() => setActionTaskId("")} onApply={onTaskAction} onScheduleCalendar={onScheduleCalendar} /> : null}
            </div>
          </WorkspaceCard>

          {!focusMode ? <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: 10 }}>
            <WorkspaceCard theme={theme} title="Candidate Rescue" subtitle="Candidates with confirmed high or critical disengagement signals."><strong style={{ color: model.snapshot.risks ? theme.red : theme.green, fontSize: 26 }}>{model.snapshot.risks}</strong><button type="button" onClick={() => setQueueFilter("Candidate Rescue")} style={{ display: "block", marginTop: 8, border: 0, background: "transparent", color: theme.primary2, fontWeight: 900, cursor: "pointer", padding: 0 }}>Review rescue items →</button></WorkspaceCard>
            <WorkspaceCard theme={theme} title="Waiting on Others" subtitle="The next step is owned outside recruiting."><strong style={{ color: model.snapshot.waiting ? theme.amber : theme.green, fontSize: 26 }}>{model.snapshot.waiting}</strong><button type="button" onClick={() => setQueueFilter("Waiting on Others")} style={{ display: "block", marginTop: 8, border: 0, background: "transparent", color: theme.primary2, fontWeight: 900, cursor: "pointer", padding: 0 }}>Review blocked work →</button></WorkspaceCard>
            <WorkspaceCard theme={theme} title="New Hire Watch" subtitle="Offers, background, credentialing, orientation, and liaison-owned steps."><strong style={{ color: model.snapshot.newHires ? theme.amber : theme.green, fontSize: 26 }}>{model.snapshot.newHires}</strong><button type="button" onClick={() => setQueueFilter("Onboarding")} style={{ display: "block", marginTop: 8, border: 0, background: "transparent", color: theme.primary2, fontWeight: 900, cursor: "pointer", padding: 0 }}>Review new hires →</button></WorkspaceCard>
          </div> : null}

          {!focusMode ? <WorkspaceCard theme={theme} title="Weekly Report Readiness" subtitle="Derived from the same current candidate, requisition, ownership, and facility records used by the work queue." action={<button type="button" onClick={onOpenWeeklyCleanup} style={{ border: `1px solid ${theme.primary2}`, borderRadius: 6, background: theme.panel, color: theme.primary2, padding: "7px 10px", fontWeight: 900, cursor: "pointer" }}>Open Weekly Cleanup</button>}>
            <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "140px 1fr", gap: 14, alignItems: "center" }}>
              <div><strong style={{ display: "block", fontSize: 32, color: healthColor(model.health.reportingReadiness.status, theme) }}>{model.reportReadiness.percent == null ? "—" : `${model.reportReadiness.percent}%`}</strong><span style={{ color: theme.muted, fontSize: 11 }}>{model.reportReadiness.autoComplete} checks complete · {model.reportReadiness.requiresReview} need review</span></div>
              <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: 5, color: theme.muted, fontSize: 12 }}>
                {[["Missing notes", model.reportReadiness.missingNotes], ["Missing risk explanations", model.reportReadiness.missingRiskExplanations], ["Missing start dates", model.reportReadiness.missingStartDates], ["Facility conflicts", model.reportReadiness.facilityIssues], ["Requisition issues", model.reportReadiness.requisitionIssues], ["Unresolved ownership", model.reportReadiness.unresolvedOwnership], ["Unclassified outcomes", model.reportReadiness.unclassifiedOutcomes], ["Calendar outcomes", model.reportReadiness.calendarEventsMissingOutcomes]].map(([label, count]) => <span key={label}>{label}: <strong style={{ color: count ? theme.amber : theme.green }}>{count}</strong></span>)}
              </div>
            </div>
            <button type="button" onClick={() => setReadinessExpanded((value) => !value)} style={{ marginTop: 12, border: `1px solid ${theme.borderSoft}`, borderRadius: 6, background: theme.panelAlt, color: theme.primary2, padding: "7px 10px", fontWeight: 900, cursor: "pointer" }}>{readinessExpanded ? "Hide Missing Items" : "Review Missing Items"}</button>
            {readinessExpanded ? <div role="region" aria-label="Weekly report readiness issues" style={{ display: "grid", gap: 6, marginTop: 10 }}>
              {model.reportReadiness.issues.length ? model.reportReadiness.issues.slice(0, 12).map((issue, index) => <div key={`${issue.code}:${issue.sourceId}:${index}`} style={{ border: `1px solid ${theme.borderSoft}`, borderRadius: 6, padding: 8, background: theme.panelAlt, display: "flex", justifyContent: "space-between", gap: 10, fontSize: 11 }}><span><strong>{issue.label}</strong><span style={{ display: "block", color: theme.muted }}>{issue.sourceType} · {issue.code}</span></span><span style={{ color: theme.primary2, fontWeight: 850 }}>{issue.fixLocation}</span></div>) : <div style={{ color: theme.green, fontWeight: 850 }}>No report-readiness gaps were found.</div>}
              {model.reportReadiness.issues.length > 12 ? <span style={{ color: theme.muted, fontSize: 11 }}>Showing 12 of {model.reportReadiness.issues.length} items. Open Weekly Cleanup for the full review.</span> : null}
            </div> : null}
          </WorkspaceCard> : null}
        </main>

        {!focusMode ? <aside style={{ display: "grid", gap: 14 }}>
          <WorkspaceCard theme={theme} title="Today Snapshot" subtitle="Select a metric to filter the queue.">
            <div style={{ display: "grid", gap: 7 }}>
              {[
                ["Urgent Actions", model.snapshot.urgent, "Urgent"],
                ["Waiting on Others", model.snapshot.waiting, "Waiting on Others"],
                ["Candidate Risks", model.snapshot.risks, "Candidate Rescue"],
                ["New Hire Check-ins", model.snapshot.newHires, "Onboarding"],
                ["Recruiting Goal", `${model.snapshot.recruitingGoal}%`, "Recruiting Needed"],
                ["Report Ready", model.snapshot.reportReady == null ? "—" : `${model.snapshot.reportReady}%`, null],
              ].map(([label, value, filter]) => <button key={label} type="button" onClick={() => filter ? setQueueFilter(filter) : onOpenWeeklyCleanup()} style={{ border: `1px solid ${theme.borderSoft}`, borderRadius: 6, background: theme.panelAlt, color: theme.text, padding: 10, display: "flex", justifyContent: "space-between", gap: 10, cursor: "pointer", font: "inherit", textAlign: "left" }}><span style={{ fontWeight: 800 }}>{label}</span><strong style={{ color: theme.primary2 }}>{value}</strong></button>)}
            </div>
          </WorkspaceCard>

          <WorkspaceCard theme={theme} title="Honest Status" subtitle="Separate health signals; no combined score.">
            <div style={{ display: "grid", gap: 12 }}>
              {Object.entries(model.health).map(([key, health]) => {
                const color = healthColor(health.status, theme);
                return <div key={key}><div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12 }}><strong>{healthLabels[key]}</strong><span style={{ color, fontWeight: 900 }}>{health.status}</span></div><div style={{ height: 4, borderRadius: 999, background: theme.panelAlt, overflow: "hidden", marginTop: 6 }}><span style={{ display: "block", width: `${health.percent == null ? 0 : health.percent}%`, height: "100%", background: color }} /></div>{health.percent == null ? <span style={{ color: theme.muted, fontSize: 10 }}>No applicable records</span> : null}</div>;
              })}
            </div>
          </WorkspaceCard>
          <HomeCalendarWidget events={calendarEvents} theme={theme} onAddEvent={onAddCalendarEvent} onOpenCalendar={onOpenCalendar} onOpenEvent={(event) => onOpenCalendarEvent(event.id)} />
        </aside> : null}
      </div>
      {wrapUpOpen ? <section role="dialog" aria-modal="false" aria-label="Wrap Up My Day" style={{ border: `2px solid ${theme.primary2}`, borderRadius: 10, padding: 16, background: theme.panel, boxShadow: theme.shadow }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}><div><h2 style={{ margin: 0, color: theme.text, fontSize: 18 }}>Wrap Up My Day</h2><p style={{ margin: "4px 0 0", color: theme.muted, fontSize: 12 }}>A final check that urgent work, outside dependencies, and tomorrow’s follow-ups are visible.</p></div><button type="button" onClick={() => setWrapUpOpen(false)} aria-label="Close Wrap Up My Day" style={{ border: 0, background: "transparent", color: theme.text, fontWeight: 950, cursor: "pointer" }}>×</button></div>
        <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "repeat(2, minmax(0, 1fr))" : "repeat(4, minmax(0, 1fr))", gap: 8, marginTop: 14 }}>
          {[["Actions completed today", model.wrapUp.actionsCompleted], ["Urgent actions remaining", model.wrapUp.remainingUrgent], ["Waiting on others", model.wrapUp.waitingOnOthers], ["Tomorrow’s follow-ups", model.wrapUp.followUpsTomorrow], ["Recruiting minutes completed", model.wrapUp.recruitingMinutesCompleted], ["Candidate risks remaining", model.wrapUp.candidateRisksRemaining], ["Weekly report readiness", model.wrapUp.reportReadiness == null ? "—" : `${model.wrapUp.reportReadiness}%`], ["Events missing outcomes", model.wrapUp.eventsMissingOutcomes], ["Tasks missing owner or due date", model.wrapUp.tasksWithoutOwnerOrDueDate]].map(([label, value]) => <div key={label} style={{ border: `1px solid ${theme.borderSoft}`, borderRadius: 7, padding: 10, background: theme.panelAlt }}><strong style={{ display: "block", color: theme.primary2, fontSize: 20 }}>{value}</strong><span style={{ color: theme.muted, fontSize: 11 }}>{label}</span></div>)}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          <button type="button" onClick={() => { setQueueFilter("Urgent"); setWrapUpOpen(false); }} style={{ border: 0, borderRadius: 6, padding: "9px 12px", background: theme.primary2, color: "#fff", fontWeight: 900, cursor: "pointer" }}>Plan Tomorrow</button>
          <button type="button" onClick={() => { setQueueFilter("Do Now"); setWrapUpOpen(false); }} style={{ border: `1px solid ${theme.borderSoft}`, borderRadius: 6, padding: "9px 12px", background: theme.panel, color: theme.text, fontWeight: 850, cursor: "pointer" }}>Reassign Task</button>
          <button type="button" onClick={() => { setQueueFilter("Waiting on Others"); setWrapUpOpen(false); }} style={{ border: `1px solid ${theme.borderSoft}`, borderRadius: 6, padding: "9px 12px", background: theme.panel, color: theme.text, fontWeight: 850, cursor: "pointer" }}>Schedule Follow-Up</button>
          <button type="button" onClick={() => { onOpenCalendar(); setWrapUpOpen(false); }} style={{ border: `1px solid ${theme.borderSoft}`, borderRadius: 6, padding: "9px 12px", background: theme.panel, color: theme.text, fontWeight: 850, cursor: "pointer" }}>Add Event Outcome</button>
          <button type="button" onClick={() => { onWorkspaceEvent({ type: "Recruiter Day Finished", subject: "Daily workspace review", body: `${model.wrapUp.remainingUrgent} urgent actions remain; ${model.wrapUp.waitingOnOthers} items are waiting on others.`, meta: { source: "Recruiter Workspace", reportReadiness: model.wrapUp.reportReadiness } }); setWrapUpOpen(false); }} style={{ border: `1px solid ${theme.green}`, borderRadius: 6, padding: "9px 12px", background: theme.greenBg, color: theme.green, fontWeight: 900, cursor: "pointer" }}>Finish Day</button>
        </div>
      </section> : null}
    </div>
  );
}
