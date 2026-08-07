import React, { useEffect, useMemo, useState } from "react";
import {
  CALENDAR_CONFIRMATION_STATUSES,
  CALENDAR_OUTCOME_STATUSES,
  RECRUITING_EVENT_TYPES,
  defaultDurationForEventType,
  detectInternalCalendarConflicts,
  eventsForCalendarDate,
  normalizeInternalCalendarEvent,
} from "./internalCalendar";
import {
  getLocalCalendarDate,
  getLocalCalendarDateKey,
  getLocalCalendarWeekRange,
} from "./calendarDate";

const VIEWS = ["Day", "Work Week", "Week", "Month", "Agenda"];

function dateStrip(value, days = 7) {
  const { start } = getLocalCalendarWeekRange(value, days);
  if (!start) return [];
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time not set" : date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function eventIcon(type = "") {
  if (/screen/i.test(type)) return "☎";
  if (/interview/i.test(type)) return "◎";
  if (/follow-up|deadline/i.test(type)) return "↗";
  if (/orientation|start date/i.test(type)) return "◆";
  if (/focus/i.test(type)) return "◉";
  if (/offer/i.test(type)) return "★";
  return "•";
}

function CalendarCard({ children, theme }) {
  return <section style={{ background: theme.panel, border: `1px solid ${theme.borderSoft}`, borderRadius: 10, padding: 14, boxShadow: theme.shadow }}>{children}</section>;
}

function emptyDraft(recruiterName) {
  const start = new Date();
  start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15, 0, 0);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + 30);
  return {
    eventType: "Candidate Phone Screen",
    title: "",
    description: "",
    date: getLocalCalendarDateKey(start),
    startTime: start.toTimeString().slice(0, 5),
    endTime: end.toTimeString().slice(0, 5),
    timeZone: "America/New_York",
    candidateId: "",
    requisitionId: "",
    facilityId: "",
    recruiterId: "current-recruiter",
    recruiterName,
    confirmationStatus: "Pending",
    locationType: "Not specified",
    location: "",
    meetingUrl: "",
    reminderMinutes: 60,
  };
}

function eventFromDraft(draft, candidates, requisitions, sites, existing = {}) {
  const candidate = candidates.find((item) => item.id === draft.candidateId);
  const requisition = requisitions.find((item) => item.id === draft.requisitionId || item.requisitionId === draft.requisitionId);
  const facility = sites.find((item) => item.id === draft.facilityId);
  const start = new Date(`${draft.date}T${draft.startTime || "09:00"}:00`);
  const end = new Date(`${draft.date}T${draft.endTime || "09:30"}:00`);
  return normalizeInternalCalendarEvent({
    ...existing,
    eventType: draft.eventType,
    title: draft.title || `${draft.eventType}${candidate?.candidate ? `: ${candidate.candidate}` : ""}`,
    description: draft.description,
    startDateTime: start.toISOString(),
    endDateTime: end.toISOString(),
    timeZone: draft.timeZone,
    candidateId: draft.candidateId,
    candidateName: candidate?.candidate || candidate?.candidateName || existing.candidateName,
    requisitionId: draft.requisitionId,
    position: requisition?.positionTitle || candidate?.position || existing.position,
    facilityId: draft.facilityId || requisition?.facilityId || candidate?.facilityId,
    facilityName: facility?.siteName || requisition?.siteName || candidate?.site || existing.facilityName,
    recruiterId: draft.recruiterId,
    recruiterName: draft.recruiterName,
    confirmationStatus: draft.confirmationStatus,
    locationType: draft.locationType,
    location: draft.location,
    meetingUrl: draft.meetingUrl,
    reminderSettings: { enabled: true, minutesBefore: Number(draft.reminderMinutes || 60) },
  });
}

function draftFromEvent(event) {
  const normalized = normalizeInternalCalendarEvent(event);
  const start = new Date(normalized.startDateTime);
  const end = new Date(normalized.endDateTime);
  return {
    ...normalized,
    date: getLocalCalendarDateKey(start),
    startTime: start.toTimeString().slice(0, 5),
    endTime: end.toTimeString().slice(0, 5),
    reminderMinutes: normalized.reminderSettings.minutesBefore,
  };
}

function CalendarEventEditor({ draft, setDraft, events, candidates, requisitions, sites, editingEvent, onClose, onSave, theme }) {
  const proposed = useMemo(() => {
    try {
      return eventFromDraft(draft, candidates, requisitions, sites, editingEvent || {});
    } catch {
      return null;
    }
  }, [draft, candidates, requisitions, sites, editingEvent]);
  const conflicts = useMemo(() => proposed ? detectInternalCalendarConflicts(events, proposed) : [], [events, proposed]);
  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const selectCandidate = (candidateId) => {
    const candidate = candidates.find((item) => item.id === candidateId);
    const requisitionId = candidate?.requisitionId || candidate?.selectedRequisitionId || candidate?.formSnapshot?.selectedRequisitionId || "";
    const requisition = requisitions.find((item) => item.id === requisitionId);
    setDraft((current) => ({
      ...current,
      candidateId,
      requisitionId: requisitionId || current.requisitionId,
      facilityId: candidate?.facilityId || requisition?.facilityId || current.facilityId,
    }));
  };
  const changeType = (eventType) => {
    const duration = defaultDurationForEventType(eventType);
    const start = new Date(`${draft.date}T${draft.startTime}:00`);
    start.setMinutes(start.getMinutes() + duration);
    setDraft((current) => ({ ...current, eventType, endTime: start.toTimeString().slice(0, 5) }));
  };
  return (
    <section role="dialog" aria-modal="true" aria-label={editingEvent ? "Edit calendar event" : "Create calendar event"} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(19, 10, 53, 0.42)", display: "grid", placeItems: "center", padding: 18 }}>
      <div style={{ width: "min(820px, 100%)", maxHeight: "92vh", overflowY: "auto", borderRadius: 12, padding: 18, background: theme.panel, color: theme.text, boxShadow: "0 28px 70px rgba(19,10,53,0.34)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}><div><h2 style={{ margin: 0 }}>{editingEvent ? "Edit Recruiting Event" : "Schedule Recruiting Event"}</h2><p style={{ margin: "4px 0 0", color: theme.muted }}>WelcomeFlow internal calendar only. No external availability is checked.</p></div><button type="button" onClick={onClose} aria-label="Close event editor" style={{ border: 0, background: "transparent", color: theme.text, fontSize: 20, cursor: "pointer" }}>×</button></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10, marginTop: 16 }}>
          <label>Event Type<select aria-label="Event Type" value={draft.eventType} onChange={(event) => changeType(event.target.value)} style={{ width: "100%", padding: 9 }}>{RECRUITING_EVENT_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
          <label>Candidate<select aria-label="Candidate" value={draft.candidateId} onChange={(event) => selectCandidate(event.target.value)} style={{ width: "100%", padding: 9 }}><option value="">No candidate</option>{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.candidate || candidate.candidateName || "Unnamed candidate"}</option>)}</select></label>
          <label>Requisition<select aria-label="Requisition" value={draft.requisitionId} onChange={(event) => update("requisitionId", event.target.value)} style={{ width: "100%", padding: 9 }}><option value="">No requisition</option>{requisitions.map((req) => <option key={req.id || req.requisitionId} value={req.id || req.requisitionId}>{req.reqNumber || "No req"} · {req.positionTitle || "No position"}</option>)}</select></label>
          <label>Facility<select aria-label="Facility" value={draft.facilityId} onChange={(event) => update("facilityId", event.target.value)} style={{ width: "100%", padding: 9 }}><option value="">Use linked facility</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.siteName}</option>)}</select></label>
          <label>Date<input aria-label="Event Date" type="date" value={draft.date} onChange={(event) => update("date", event.target.value)} style={{ width: "100%", padding: 9, boxSizing: "border-box" }} /></label>
          <label>Start Time<input aria-label="Start Time" type="time" value={draft.startTime} onChange={(event) => update("startTime", event.target.value)} style={{ width: "100%", padding: 9, boxSizing: "border-box" }} /></label>
          <label>End Time<input aria-label="End Time" type="time" value={draft.endTime} onChange={(event) => update("endTime", event.target.value)} style={{ width: "100%", padding: 9, boxSizing: "border-box" }} /></label>
          <label>Time Zone<select aria-label="Time Zone" value={draft.timeZone} onChange={(event) => update("timeZone", event.target.value)} style={{ width: "100%", padding: 9 }}><option>America/New_York</option><option>America/Chicago</option><option>America/Denver</option><option>America/Los_Angeles</option></select></label>
          <label>Confirmation<select aria-label="Confirmation Status" value={draft.confirmationStatus} onChange={(event) => update("confirmationStatus", event.target.value)} style={{ width: "100%", padding: 9 }}>{CALENDAR_CONFIRMATION_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
          <label>Location Type<select aria-label="Location Type" value={draft.locationType} onChange={(event) => update("locationType", event.target.value)} style={{ width: "100%", padding: 9 }}><option>Not specified</option><option>Phone</option><option>On-site</option><option>Virtual</option></select></label>
          <label>Location<input aria-label="Location" value={draft.location} onChange={(event) => update("location", event.target.value)} style={{ width: "100%", padding: 9, boxSizing: "border-box" }} /></label>
          <label>Meeting URL<input aria-label="Meeting URL" value={draft.meetingUrl} onChange={(event) => update("meetingUrl", event.target.value)} placeholder="Optional manually entered URL" style={{ width: "100%", padding: 9, boxSizing: "border-box" }} /></label>
        </div>
        <label style={{ display: "grid", gap: 4, marginTop: 10 }}>Title<input aria-label="Event Title" value={draft.title} onChange={(event) => update("title", event.target.value)} style={{ padding: 9 }} /></label>
        <label style={{ display: "grid", gap: 4, marginTop: 10 }}>Notes<textarea aria-label="Event Notes" value={draft.description} onChange={(event) => update("description", event.target.value)} rows={3} style={{ padding: 9, resize: "vertical" }} /></label>
        {conflicts.length ? <div role="alert" style={{ marginTop: 12, border: `1px solid ${theme.amber}`, borderRadius: 7, padding: 10, background: theme.amberBg, color: theme.amber }}><strong>WelcomeFlow scheduling conflict</strong><div>{conflicts.length} overlapping internal event{conflicts.length === 1 ? "" : "s"} for this recruiter. External availability has not been checked.</div></div> : null}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}><button type="button" onClick={onClose} style={{ padding: "9px 13px", border: `1px solid ${theme.borderSoft}`, borderRadius: 6, background: theme.panel }}>Cancel</button><button type="button" onClick={() => onSave(proposed, Boolean(editingEvent))} disabled={!proposed?.startDateTime || !proposed?.endDateTime} style={{ padding: "9px 13px", border: 0, borderRadius: 6, background: theme.primary2, color: "#fff", fontWeight: 900 }}>Save Event</button></div>
      </div>
    </section>
  );
}

export function InternalCalendarPage({ events = [], candidates = [], requisitions = [], sites = [], recruiterName = "Recruiter", theme, isNarrow = false, createRequestToken = 0, createPrefill = {}, selectedEventId = "", onCreateEvent, onUpdateEvent, onOpenCandidate, onOpenRequisition, onDownloadInvitation }) {
  const [view, setView] = useState("Agenda");
  const [selectedDate, setSelectedDate] = useState(getLocalCalendarDateKey(new Date()));
  const [eventTypeFilter, setEventTypeFilter] = useState("All");
  const [facilityFilter, setFacilityFilter] = useState("All");
  const [confirmationFilter, setConfirmationFilter] = useState("All");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState("");
  const [draft, setDraft] = useState(() => emptyDraft(recruiterName));
  const [notice, setNotice] = useState("");
  const normalizedEvents = useMemo(() => events.map(normalizeInternalCalendarEvent), [events]);
  const strip = useMemo(() => dateStrip(selectedDate, 7), [selectedDate]);
  const editingEvent = normalizedEvents.find((event) => event.id === editingEventId) || null;
  const visibleEvents = useMemo(() => {
    if (view === "Day") return eventsForCalendarDate(normalizedEvents, selectedDate, { eventType: eventTypeFilter, facilityId: facilityFilter, confirmationStatus: confirmationFilter });
    const selected = getLocalCalendarDate(selectedDate);
    if (!selected) return [];
    const weekRange = getLocalCalendarWeekRange(selectedDate, view === "Work Week" ? 5 : 7);
    const rangeStart = view === "Month" ? new Date(selected.getFullYear(), selected.getMonth(), 1) : weekRange.start;
    const rangeEnd = view === "Month" ? new Date(selected.getFullYear(), selected.getMonth() + 1, 1) : weekRange.end;
    if (!rangeStart || !rangeEnd) return [];
    return normalizedEvents.filter((event) => {
      const start = new Date(event.startDateTime);
      if (event.eventStatus === "Canceled" || start < rangeStart || start >= rangeEnd) return false;
      if (eventTypeFilter !== "All" && event.eventType !== eventTypeFilter) return false;
      if (facilityFilter !== "All" && event.facilityId !== facilityFilter) return false;
      if (confirmationFilter !== "All" && event.confirmationStatus !== confirmationFilter) return false;
      return true;
    }).sort((a, b) => a.startDateTime.localeCompare(b.startDateTime));
  }, [normalizedEvents, selectedDate, view, eventTypeFilter, facilityFilter, confirmationFilter]);
  const openCreate = (prefill = {}) => {
    setEditingEventId("");
    setDraft({ ...emptyDraft(recruiterName), date: selectedDate, ...prefill });
    setEditorOpen(true);
  };
  const openEdit = (event) => {
    setEditingEventId(event.id);
    setDraft(draftFromEvent(event));
    setEditorOpen(true);
  };
  useEffect(() => {
    if (!createRequestToken) return;
    setEditingEventId("");
    setDraft({ ...emptyDraft(recruiterName), ...createPrefill });
    setEditorOpen(true);
  }, [createRequestToken, createPrefill, recruiterName]);
  useEffect(() => {
    if (!selectedEventId) return;
    const selected = normalizedEvents.find((event) => event.id === selectedEventId);
    if (!selected) return;
    setEditingEventId(selected.id);
    setDraft(draftFromEvent(selected));
    setEditorOpen(true);
  }, [selectedEventId, normalizedEvents]);
  const saveEvent = (event, editing) => {
    const wasRescheduled = editing && editingEvent && (
      editingEvent.startDateTime !== event.startDateTime ||
      editingEvent.endDateTime !== event.endDateTime
    );
    const result = editing ? onUpdateEvent(editingEventId, event, wasRescheduled ? "reschedule" : "update") : onCreateEvent(event);
    if (result?.ok === false) { setNotice(result.error); return; }
    setEditorOpen(false);
    setEditingEventId("");
    setNotice(result?.conflicts?.length ? "Event saved with an internal scheduling conflict warning." : "Event saved to the WelcomeFlow internal calendar.");
  };
  const updateOutcome = (event, outcomeStatus) => {
    const result = onUpdateEvent(event.id, { outcomeStatus }, "outcome");
    setNotice(result?.ok === false ? result.error : "Event outcome saved and connected work refreshed.");
  };
  const cancelEvent = (event) => {
    const reason = window.prompt("Why is this event being canceled?");
    if (!reason) return;
    const result = onUpdateEvent(event.id, { cancellationReason: reason }, "cancel");
    setNotice(result?.ok === false ? result.error : "Event canceled. History and connected work were preserved.");
  };
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}><div><h1 style={{ margin: 0, color: theme.text }}>Calendar</h1><p style={{ margin: "4px 0 0", color: theme.muted }}>Internal WelcomeFlow recruiting schedule · external availability is not connected</p></div><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button type="button" onClick={() => openCreate()} style={{ border: 0, borderRadius: 6, padding: "9px 13px", background: theme.primary2, color: "#fff", fontWeight: 900 }}>+ Add Event</button><button type="button" onClick={() => openCreate({ eventType: "Facility Interview" })} style={{ border: `1px solid ${theme.borderSoft}`, borderRadius: 6, padding: "9px 13px", background: theme.panel, color: theme.text, fontWeight: 850 }}>Schedule Interview</button></div></header>
      {notice ? <div role="status" style={{ border: `1px solid ${theme.borderSoft}`, borderRadius: 7, padding: 9, background: theme.panelAlt }}>{notice}</div> : null}
      <CalendarCard theme={theme}>
        <div role="tablist" aria-label="Calendar views" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{VIEWS.map((item) => <button key={item} type="button" role="tab" aria-selected={view === item} onClick={() => setView(item)} style={{ border: `1px solid ${view === item ? theme.primary2 : theme.borderSoft}`, borderRadius: 6, padding: "7px 10px", background: view === item ? theme.primary2 : theme.panelAlt, color: view === item ? "#fff" : theme.text, fontWeight: 850 }}>{item}</button>)}</div>
        <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 12 }}>
          <label>Event Type<select aria-label="Filter by Event Type" value={eventTypeFilter} onChange={(event) => setEventTypeFilter(event.target.value)} style={{ width: "100%", padding: 8 }}><option>All</option>{RECRUITING_EVENT_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
          <label>Facility<select aria-label="Filter by Facility" value={facilityFilter} onChange={(event) => setFacilityFilter(event.target.value)} style={{ width: "100%", padding: 8 }}><option>All</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.siteName}</option>)}</select></label>
          <label>Confirmation<select aria-label="Filter by Confirmation" value={confirmationFilter} onChange={(event) => setConfirmationFilter(event.target.value)} style={{ width: "100%", padding: 8 }}><option>All</option>{CALENDAR_CONFIRMATION_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
        </div>
        <div aria-label="Calendar date strip" style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(52px, 1fr))", gap: 5, marginTop: 14 }}>
          {strip.map((date) => {
            const key = getLocalCalendarDateKey(date);
            const count = normalizedEvents.filter((event) => event.eventStatus !== "Canceled" && getLocalCalendarDateKey(event.startDateTime) === key).length;
            const selected = key === selectedDate;
            return <button key={key} type="button" onClick={() => setSelectedDate(key)} aria-pressed={selected} style={{ border: `1px solid ${selected ? theme.primary2 : theme.borderSoft}`, borderRadius: 8, padding: "7px 3px", background: selected ? theme.primary2 : theme.panel, color: selected ? "#fff" : theme.text }}><span style={{ display: "block", fontSize: 10, fontWeight: 850 }}>{date.toLocaleDateString([], { weekday: "short" })}</span><strong style={{ display: "block", fontSize: 17 }}>{date.getDate()}</strong><span aria-label={`${count} events`} style={{ display: "block", minHeight: 10, color: selected ? "#fff" : theme.primary2 }}>{count ? "●" : ""}</span></button>;
          })}
        </div>
      </CalendarCard>
      <CalendarCard theme={theme}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}><div><h2 style={{ margin: 0, fontSize: 16 }}>{view} Schedule</h2><span style={{ color: theme.muted, fontSize: 11 }}>{visibleEvents.length} event{visibleEvents.length === 1 ? "" : "s"} in the selected view</span></div><button type="button" onClick={() => setSelectedDate(getLocalCalendarDateKey(new Date()))} style={{ border: `1px solid ${theme.borderSoft}`, borderRadius: 6, padding: "7px 10px", background: theme.panel }}>Today</button></div>
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          {visibleEvents.length ? visibleEvents.map((event) => <article key={event.id} style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "70px 36px minmax(180px, 1.3fr) minmax(170px, 1fr) auto", gap: 10, alignItems: "center", border: `1px solid ${theme.borderSoft}`, borderRadius: 8, padding: 10, borderLeft: `4px solid ${event.outcomeStatus === "Pending" && new Date(event.endDateTime) < new Date() ? theme.red : theme.primary2}` }}>
            <strong>{formatTime(event.startDateTime)}</strong><span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: "50%", background: theme.panelAlt, color: theme.primary2, display: "grid", placeItems: "center", fontWeight: 950 }}>{eventIcon(event.eventType)}</span><div><strong>{event.eventType}</strong><span style={{ display: "block", color: theme.muted, fontSize: 11 }}>{event.candidateName || event.title}</span><span style={{ display: "block", color: theme.muted, fontSize: 11 }}>{event.position || "No position"} · {event.facilityName || "No facility"}</span></div><div><span style={{ display: "block", fontSize: 11 }}>Confirmation: <strong>{event.confirmationStatus}</strong></span><span style={{ display: "block", fontSize: 11 }}>Outcome: <strong>{event.outcomeStatus}</strong></span><span style={{ display: "block", color: theme.muted, fontSize: 10 }}>{event.calendarProvider} · {event.timeZone}</span></div><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><button type="button" onClick={() => openEdit(event)}>Edit / Reschedule</button>{event.candidateId ? <button type="button" onClick={() => onOpenCandidate(event.candidateId)}>Candidate</button> : null}{event.requisitionId ? <button type="button" onClick={() => onOpenRequisition(event.requisitionId)}>Requisition</button> : null}<select aria-label={`Outcome for ${event.title}`} value={event.outcomeStatus} onChange={(change) => updateOutcome(event, change.target.value)}>{CALENDAR_OUTCOME_STATUSES.map((status) => <option key={status}>{status}</option>)}</select><button type="button" onClick={() => onDownloadInvitation(event)}>Export .ics</button><button type="button" onClick={() => cancelEvent(event)} disabled={event.eventStatus === "Canceled"}>Cancel</button></div>
          </article>) : <div style={{ border: `1px dashed ${theme.borderSoft}`, borderRadius: 8, padding: 24, textAlign: "center", color: theme.muted }}><strong style={{ display: "block", color: theme.text }}>No recruiting events in this view.</strong>Schedule a screen, follow-up, interview, or recruiting focus block.</div>}
        </div>
      </CalendarCard>
      {editorOpen ? <CalendarEventEditor draft={draft} setDraft={setDraft} events={normalizedEvents} candidates={candidates} requisitions={requisitions} sites={sites} editingEvent={editingEvent} onClose={() => setEditorOpen(false)} onSave={saveEvent} theme={theme} /> : null}
    </div>
  );
}
