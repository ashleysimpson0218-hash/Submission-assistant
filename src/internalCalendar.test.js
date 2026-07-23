import {
  buildCalendarQueueTasks,
  buildInternalCalendarInvitation,
  calendarEventsMissingOutcomes,
  createInternalCalendarEvent,
  detectInternalCalendarConflicts,
  normalizeInternalCalendarEvent,
  updateInternalCalendarEvent,
  upcomingRecruitingEvents,
} from "./internalCalendar";

const NOW = new Date("2026-07-23T12:00:00.000Z");

function syntheticEvent(overrides = {}) {
  return normalizeInternalCalendarEvent({
    id: "event-1",
    eventType: "Facility Interview",
    title: "Synthetic interview",
    startDateTime: "2026-07-23T14:00:00.000Z",
    endDateTime: "2026-07-23T15:00:00.000Z",
    timeZone: "America/New_York",
    candidateId: "candidate-1",
    candidateName: "Synthetic Candidate",
    requisitionId: "req-1",
    facilityId: "facility-1",
    facilityName: "Synthetic Facility",
    recruiterId: "recruiter-1",
    ...overrides,
  });
}

describe("internal WelcomeFlow calendar", () => {
  test("creates an internal-only provider-neutral event", () => {
    const result = createInternalCalendarEvent([], syntheticEvent(), { id: "event-1" });
    expect(result.ok).toBe(true);
    expect(result.event.calendarProvider).toBe("internal");
    expect(result.event.externalCalendarId).toBeNull();
    expect(result.event.externalEventId).toBeNull();
    expect(result.event.syncStatus).toBe("Internal only");
  });

  test("blocks duplicate events without replacing the original", () => {
    const event = syntheticEvent();
    const result = createInternalCalendarEvent([event], { ...event, id: "event-2" });
    expect(result.ok).toBe(false);
    expect(result.duplicateId).toBe("event-1");
  });

  test("detects overlapping WelcomeFlow events for one recruiter only", () => {
    const event = syntheticEvent();
    const overlapping = syntheticEvent({ id: "event-2", candidateId: "candidate-2", startDateTime: "2026-07-23T14:30:00.000Z", endDateTime: "2026-07-23T15:30:00.000Z" });
    const otherRecruiter = syntheticEvent({ id: "event-3", recruiterId: "recruiter-2", startDateTime: "2026-07-23T14:30:00.000Z", endDateTime: "2026-07-23T15:30:00.000Z" });
    expect(detectInternalCalendarConflicts([event], overlapping)).toHaveLength(1);
    expect(detectInternalCalendarConflicts([event], otherRecruiter)).toHaveLength(0);
  });

  test("reschedules without duplicating and retains history", () => {
    const event = syntheticEvent();
    const result = updateInternalCalendarEvent([event], event.id, {
      startDateTime: "2026-07-24T14:00:00.000Z",
      endDateTime: "2026-07-24T15:00:00.000Z",
      rescheduleReason: "Synthetic availability change",
    }, "reschedule", NOW);
    expect(result.ok).toBe(true);
    expect(result.events).toHaveLength(1);
    expect(result.event.rescheduleHistory).toHaveLength(1);
    expect(result.event.rescheduleHistory[0].priorStartDateTime).toBe(event.startDateTime);
  });

  test("cancellation requires a reason and preserves the event", () => {
    const event = syntheticEvent();
    expect(updateInternalCalendarEvent([event], event.id, {}, "cancel", NOW).ok).toBe(false);
    const result = updateInternalCalendarEvent([event], event.id, { cancellationReason: "Synthetic candidate request" }, "cancel", NOW);
    expect(result.event.eventStatus).toBe("Canceled");
    expect(result.event.outcomeStatus).toBe("Canceled");
    expect(result.events).toHaveLength(1);
  });

  test("records outcomes and removes the overdue outcome task", () => {
    const past = syntheticEvent({ startDateTime: "2026-07-22T14:00:00.000Z", endDateTime: "2026-07-22T15:00:00.000Z" });
    expect(buildCalendarQueueTasks([past], NOW)).toHaveLength(1);
    const result = updateInternalCalendarEvent([past], past.id, { outcomeStatus: "Attended", outcomeNotes: "Synthetic fixture completed" }, "outcome", NOW);
    expect(result.event.eventStatus).toBe("Completed");
    expect(buildCalendarQueueTasks(result.events, NOW)).toHaveLength(0);
  });

  test("creates confirmation and post-event queue tasks from the event source", () => {
    const upcoming = syntheticEvent();
    const overdue = syntheticEvent({ id: "event-overdue", startDateTime: "2026-07-22T10:00:00.000Z", endDateTime: "2026-07-22T11:00:00.000Z" });
    const tasks = buildCalendarQueueTasks([upcoming, overdue], NOW);
    expect(tasks.map((task) => task.id)).toEqual(expect.arrayContaining(["calendar-confirmation:event-1", "calendar-outcome:event-overdue"]));
    expect(tasks.every((task) => task.sourceType === "calendar")).toBe(true);
  });

  test("filters the Home widget to recruiting events", () => {
    const recruiting = syntheticEvent();
    const meeting = syntheticEvent({ id: "meeting-1", eventType: "Internal Meeting" });
    expect(upcomingRecruitingEvents([meeting, recruiting], { now: NOW, days: 7 })).toEqual([expect.objectContaining({ id: "event-1" })]);
  });

  test("reports events that passed without outcomes", () => {
    const past = syntheticEvent({ startDateTime: "2026-07-22T14:00:00.000Z", endDateTime: "2026-07-22T15:00:00.000Z" });
    expect(calendarEventsMissingOutcomes([past], NOW)).toHaveLength(1);
  });

  test("exports a provider-neutral calendar invitation", () => {
    const invitation = buildInternalCalendarInvitation(syntheticEvent());
    expect(invitation).toContain("BEGIN:VCALENDAR");
    expect(invitation).toContain("SUMMARY:Synthetic interview");
    expect(invitation).not.toMatch(/microsoft|google/i);
  });
});
