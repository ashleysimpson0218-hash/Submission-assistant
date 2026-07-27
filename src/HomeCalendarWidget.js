import React, { useMemo, useState } from "react";
import { normalizeInternalCalendarEvent, upcomingRecruitingEvents } from "./internalCalendar";
import { getLocalCalendarDateKey } from "./calendarDate";

const MODES = ["My Events", "Interviews", "All Recruiting"];

function sevenDays(now) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function timeLabel(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time not set" : date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function HomeCalendarWidget({ events = [], recruiterId = "current-recruiter", theme, onAddEvent, onOpenCalendar, onOpenEvent }) {
  const [mode, setMode] = useState("My Events");
  const [selectedDate, setSelectedDate] = useState(getLocalCalendarDateKey(new Date()));
  const normalized = useMemo(() => events.map(normalizeInternalCalendarEvent), [events]);
  const days = useMemo(() => sevenDays(new Date()), []);
  const upcoming = useMemo(() => upcomingRecruitingEvents(normalized, { mode, recruiterId, days: 7, limit: 20 }), [normalized, mode, recruiterId]);
  const agenda = upcoming.filter((event) => getLocalCalendarDateKey(event.startDateTime) === selectedDate).slice(0, 5);
  const weekSummary = {
    interviews: upcoming.filter((event) => /interview/i.test(event.eventType)).length,
    screens: upcoming.filter((event) => /screen/i.test(event.eventType)).length,
    followUps: upcoming.filter((event) => /follow-up/i.test(event.eventType)).length,
  };
  return (
    <section aria-label="Today and Upcoming" style={{ background: theme.panel, border: `1px solid ${theme.borderSoft}`, borderRadius: 10, padding: 12, boxShadow: theme.shadow }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}><div><h2 style={{ margin: 0, color: theme.text, fontSize: 15 }}>Today & Upcoming</h2><span style={{ color: theme.muted, fontSize: 10 }}>Internal recruiting calendar</span></div><button type="button" onClick={onAddEvent} aria-label="Add calendar event" style={{ width: 30, height: 30, borderRadius: "50%", border: `1px solid ${theme.primary2}`, background: theme.panel, color: theme.primary2, fontSize: 18 }}>+</button></div>
      <div role="tablist" aria-label="Home calendar filters" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 3, background: theme.panelAlt, padding: 3, borderRadius: 7, marginTop: 10 }}>{MODES.map((item) => <button key={item} type="button" role="tab" aria-selected={mode === item} onClick={() => setMode(item)} style={{ border: 0, borderRadius: 5, padding: "6px 2px", background: mode === item ? theme.primary2 : "transparent", color: mode === item ? "#fff" : theme.text, fontSize: 10, fontWeight: 850 }}>{item}</button>)}</div>
      <div aria-label="Upcoming date strip" style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginTop: 10 }}>{days.map((date) => {
        const key = getLocalCalendarDateKey(date);
        const count = upcoming.filter((event) => getLocalCalendarDateKey(event.startDateTime) === key).length;
        const selected = key === selectedDate;
        return <button key={key} type="button" onClick={() => setSelectedDate(key)} aria-pressed={selected} style={{ border: `1px solid ${selected ? theme.primary2 : "transparent"}`, borderRadius: 7, background: selected ? theme.primary2 : theme.panelAlt, color: selected ? "#fff" : theme.text, padding: "5px 1px" }}><span style={{ display: "block", fontSize: 8, fontWeight: 850 }}>{date.toLocaleDateString([], { weekday: "narrow" })}</span><strong style={{ display: "block", fontSize: 13 }}>{date.getDate()}</strong><span aria-label={`${count} events`} style={{ display: "block", height: 6, fontSize: 7 }}>{count ? "●" : ""}</span></button>;
      })}</div>
      <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
        {agenda.length ? agenda.map((event) => <button key={event.id} type="button" onClick={() => onOpenEvent(event)} style={{ border: `1px solid ${theme.borderSoft}`, borderRadius: 7, padding: 8, background: theme.panel, color: theme.text, textAlign: "left", display: "grid", gridTemplateColumns: "58px 1fr", gap: 8 }}><strong style={{ color: theme.primary2, fontSize: 11 }}>{timeLabel(event.startDateTime)}</strong><span><strong style={{ display: "block", fontSize: 11 }}>{event.eventType}</strong><span style={{ display: "block", fontSize: 10 }}>{event.candidateName || event.title}</span><span style={{ display: "block", color: theme.muted, fontSize: 9 }}>{event.position || "No position"} · {event.facilityName || "No facility"}</span></span></button>) : <div style={{ border: `1px dashed ${theme.borderSoft}`, borderRadius: 7, padding: 12, textAlign: "center", color: theme.muted, fontSize: 10 }}><strong style={{ display: "block", color: theme.text }}>No recruiting events scheduled today.</strong>Schedule a screen or protect recruiting time.</div>}
      </div>
      <div style={{ marginTop: 10, color: theme.muted, fontSize: 10 }}>{weekSummary.interviews} interview{weekSummary.interviews === 1 ? "" : "s"}, {weekSummary.screens} screen{weekSummary.screens === 1 ? "" : "s"}, and {weekSummary.followUps} follow-up{weekSummary.followUps === 1 ? "" : "s"} this week.</div>
      <div style={{ display: "flex", gap: 6, marginTop: 9 }}><button type="button" onClick={onOpenCalendar} style={{ flex: 1, border: `1px solid ${theme.primary2}`, borderRadius: 6, background: theme.panel, color: theme.primary2, padding: 7, fontWeight: 850 }}>Open Calendar</button><button type="button" onClick={onAddEvent} style={{ flex: 1, border: 0, borderRadius: 6, background: theme.primary2, color: "#fff", padding: 7, fontWeight: 850 }}>Schedule Interview</button></div>
    </section>
  );
}
