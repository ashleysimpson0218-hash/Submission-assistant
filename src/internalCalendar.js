export const INTERNAL_CALENDAR_PROVIDER = "internal";

export const RECRUITING_EVENT_TYPES = Object.freeze([
  "Candidate Phone Screen",
  "Facility Interview",
  "Hiring Manager Interview",
  "Recruiter Follow-Up",
  "Candidate Follow-Up",
  "Offer Call",
  "Hiring Event",
  "Orientation",
  "Start Date",
  "Document Deadline",
  "Background Follow-Up",
  "Manager Feedback Deadline",
  "Recruiting Focus Block",
  "Internal Meeting",
  "Busy Block",
]);

export const CALENDAR_EVENT_STATUSES = Object.freeze(["Scheduled", "Completed", "Canceled"]);
export const CALENDAR_CONFIRMATION_STATUSES = Object.freeze(["Not Required", "Pending", "Confirmed", "Declined"]);
export const CALENDAR_OUTCOME_STATUSES = Object.freeze(["Pending", "Attended", "Candidate No-Show", "Hiring Manager No-Show", "Completed", "Canceled"]);

const text = (value) => String(value || "").trim();

function validDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function makeInternalId(prefix = "calendar") {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function minutesAfter(value, minutes) {
  const date = validDate(value);
  if (!date) return "";
  date.setMinutes(date.getMinutes() + Number(minutes || 0));
  return date.toISOString();
}

export function defaultDurationForEventType(eventType = "") {
  if (/focus block/i.test(eventType)) return 60;
  if (/interview|hiring event|orientation/i.test(eventType)) return 60;
  if (/screen|offer call/i.test(eventType)) return 30;
  if (/follow-up|deadline/i.test(eventType)) return 15;
  return 30;
}

export function normalizeInternalCalendarEvent(event = {}) {
  const now = new Date().toISOString();
  const eventType = RECRUITING_EVENT_TYPES.includes(event.eventType) ? event.eventType : "Recruiter Follow-Up";
  const startDateTime = validDate(event.startDateTime)?.toISOString() || "";
  const endDateTime = validDate(event.endDateTime)?.toISOString() || (startDateTime ? minutesAfter(startDateTime, defaultDurationForEventType(eventType)) : "");
  return {
    id: text(event.id) || makeInternalId(),
    eventType,
    title: text(event.title) || eventType,
    description: text(event.description),
    startDateTime,
    endDateTime,
    timeZone: text(event.timeZone) || "America/New_York",
    candidateId: text(event.candidateId),
    candidateName: text(event.candidateName),
    requisitionId: text(event.requisitionId),
    position: text(event.position),
    facilityId: text(event.facilityId),
    facilityName: text(event.facilityName),
    recruiterId: text(event.recruiterId),
    recruiterName: text(event.recruiterName) || "Recruiter",
    hiringManagerIds: Array.from(new Set((Array.isArray(event.hiringManagerIds) ? event.hiringManagerIds : []).map(text).filter(Boolean))),
    hiringManagerNames: Array.from(new Set((Array.isArray(event.hiringManagerNames) ? event.hiringManagerNames : []).map(text).filter(Boolean))),
    attendeeIds: Array.from(new Set((Array.isArray(event.attendeeIds) ? event.attendeeIds : []).map(text).filter(Boolean))),
    eventStatus: CALENDAR_EVENT_STATUSES.includes(event.eventStatus) ? event.eventStatus : "Scheduled",
    confirmationStatus: CALENDAR_CONFIRMATION_STATUSES.includes(event.confirmationStatus) ? event.confirmationStatus : "Pending",
    locationType: text(event.locationType) || "Not specified",
    location: text(event.location),
    meetingUrl: text(event.meetingUrl),
    calendarProvider: INTERNAL_CALENDAR_PROVIDER,
    externalCalendarId: null,
    externalEventId: null,
    syncStatus: "Internal only",
    lastSyncedAt: null,
    reminderSettings: {
      enabled: event.reminderSettings?.enabled !== false,
      minutesBefore: Number.isFinite(Number(event.reminderSettings?.minutesBefore)) ? Number(event.reminderSettings.minutesBefore) : 60,
    },
    connectedTaskIds: Array.from(new Set((Array.isArray(event.connectedTaskIds) ? event.connectedTaskIds : []).map(text).filter(Boolean))),
    outcomeStatus: CALENDAR_OUTCOME_STATUSES.includes(event.outcomeStatus) ? event.outcomeStatus : "Pending",
    outcomeNotes: text(event.outcomeNotes),
    completedAt: text(event.completedAt),
    cancelledAt: text(event.cancelledAt),
    cancellationReason: text(event.cancellationReason),
    rescheduleHistory: Array.isArray(event.rescheduleHistory) ? event.rescheduleHistory.map((entry) => ({ ...entry })) : [],
    createdAt: text(event.createdAt) || now,
    updatedAt: text(event.updatedAt) || now,
  };
}

export function internalEventSignature(event = {}) {
  const normalized = normalizeInternalCalendarEvent(event);
  return [
    normalized.candidateId || normalized.requisitionId || normalized.recruiterId,
    normalized.eventType,
    normalized.startDateTime,
  ].join("|").toLowerCase();
}

export function createInternalCalendarEvent(events = [], input = {}, options = {}) {
  const event = normalizeInternalCalendarEvent({ ...input, id: input.id || options.id });
  if (!event.startDateTime || !event.endDateTime) return { ok: false, error: "Choose a valid start and end time." };
  if (new Date(event.endDateTime) <= new Date(event.startDateTime)) return { ok: false, error: "The event must end after it starts." };
  const duplicate = events.map(normalizeInternalCalendarEvent).find((existing) => existing.eventStatus !== "Canceled" && internalEventSignature(existing) === internalEventSignature(event));
  if (duplicate) return { ok: false, error: "This recruiting event is already scheduled.", duplicateId: duplicate.id };
  return { ok: true, event, events: [...events.map(normalizeInternalCalendarEvent), event] };
}

export function detectInternalCalendarConflicts(events = [], candidate = {}) {
  const proposed = normalizeInternalCalendarEvent(candidate);
  if (!proposed.startDateTime || !proposed.endDateTime || proposed.eventStatus === "Canceled") return [];
  const start = new Date(proposed.startDateTime).getTime();
  const end = new Date(proposed.endDateTime).getTime();
  return events.map(normalizeInternalCalendarEvent).filter((event) => {
    if (event.id === proposed.id || event.eventStatus === "Canceled") return false;
    if (proposed.recruiterId && event.recruiterId && proposed.recruiterId !== event.recruiterId) return false;
    const otherStart = new Date(event.startDateTime).getTime();
    const otherEnd = new Date(event.endDateTime).getTime();
    return Number.isFinite(otherStart) && Number.isFinite(otherEnd) && start < otherEnd && end > otherStart;
  });
}

export function updateInternalCalendarEvent(events = [], eventId, changes = {}, action = "update", now = new Date()) {
  const current = events.map(normalizeInternalCalendarEvent).find((event) => event.id === eventId);
  if (!current) return { ok: false, error: "WelcomeFlow could not locate that calendar event." };
  const timestamp = now.toISOString();
  let patch = { ...changes, updatedAt: timestamp };
  if (action === "reschedule") {
    patch = {
      ...patch,
      eventStatus: "Scheduled",
      outcomeStatus: "Pending",
      rescheduleHistory: [...current.rescheduleHistory, {
        priorStartDateTime: current.startDateTime,
        priorEndDateTime: current.endDateTime,
        changedAt: timestamp,
        reason: text(changes.rescheduleReason),
      }],
    };
  }
  if (action === "cancel") {
    if (!text(changes.cancellationReason)) return { ok: false, error: "Add a cancellation reason." };
    patch = { ...patch, eventStatus: "Canceled", outcomeStatus: "Canceled", cancelledAt: timestamp };
  }
  if (action === "outcome") {
    if (!CALENDAR_OUTCOME_STATUSES.includes(changes.outcomeStatus) || changes.outcomeStatus === "Pending") return { ok: false, error: "Choose the event outcome." };
    patch = { ...patch, eventStatus: changes.outcomeStatus === "Canceled" ? "Canceled" : "Completed", completedAt: timestamp };
  }
  const event = normalizeInternalCalendarEvent({ ...current, ...patch });
  if (new Date(event.endDateTime) <= new Date(event.startDateTime)) return { ok: false, error: "The event must end after it starts." };
  const conflicts = detectInternalCalendarConflicts(events, event);
  return { ok: true, event, conflicts, events: events.map((entry) => entry.id === eventId ? event : normalizeInternalCalendarEvent(entry)) };
}

export function eventsForCalendarDate(events = [], date, filters = {}) {
  const day = text(date).slice(0, 10);
  return events.map(normalizeInternalCalendarEvent).filter((event) => {
    if (event.eventStatus === "Canceled" && filters.includeCanceled !== true) return false;
    if (day && event.startDateTime.slice(0, 10) !== day) return false;
    if (filters.eventType && filters.eventType !== "All" && event.eventType !== filters.eventType) return false;
    if (filters.facilityId && filters.facilityId !== "All" && event.facilityId !== filters.facilityId) return false;
    if (filters.candidateId && filters.candidateId !== "All" && event.candidateId !== filters.candidateId) return false;
    if (filters.confirmationStatus && filters.confirmationStatus !== "All" && event.confirmationStatus !== filters.confirmationStatus) return false;
    return true;
  }).sort((a, b) => a.startDateTime.localeCompare(b.startDateTime));
}

export function upcomingRecruitingEvents(events = [], options = {}) {
  const now = validDate(options.now) || new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + Number(options.days || 7));
  const mode = options.mode || "My Events";
  return events.map(normalizeInternalCalendarEvent).filter((event) => {
    const start = validDate(event.startDateTime);
    if (!start || start < now || start > end || event.eventStatus === "Canceled") return false;
    if (mode === "Interviews" && !/interview/i.test(event.eventType)) return false;
    if (mode === "My Events" && options.recruiterId && event.recruiterId && event.recruiterId !== options.recruiterId) return false;
    return !/Internal Meeting|Busy Block/.test(event.eventType);
  }).sort((a, b) => a.startDateTime.localeCompare(b.startDateTime)).slice(0, Number(options.limit || 5));
}

export function buildCalendarQueueTasks(events = [], now = new Date()) {
  const current = validDate(now) || new Date();
  return events.map(normalizeInternalCalendarEvent).flatMap((event) => {
    const start = validDate(event.startDateTime);
    if (!start || event.eventStatus === "Canceled") return [];
    const hoursUntil = (start.getTime() - current.getTime()) / 3600000;
    if (start < current && event.outcomeStatus === "Pending") {
      return [{
        id: `calendar-outcome:${event.id}`,
        sourceType: "calendar",
        sourceId: event.id,
        candidateId: event.candidateId,
        requisitionId: event.requisitionId,
        candidateName: event.candidateName || event.title,
        position: event.position || "Position not assigned",
        facilityName: event.facilityName || "Facility not assigned",
        title: "Add event outcome",
        category: "Stuck",
        filters: ["Do Now", "Stuck"],
        ownerType: "Recruiter",
        ownerLabel: event.recruiterName || "Recruiter",
        riskLevel: hoursUntil <= -24 ? "High" : "Medium",
        riskReason: `${event.eventType} passed without an outcome.`,
        reason: `${event.eventType} occurred ${Math.max(1, Math.floor(Math.abs(hoursUntil)))} hour${Math.floor(Math.abs(hoursUntil)) === 1 ? "" : "s"} ago and has no recorded outcome.`,
        dueAt: event.endDateTime,
        isOverdue: true,
        daysWaiting: Math.floor(Math.abs(hoursUntil) / 24),
        estimatedMinutes: 5,
        recommendedAction: "Add the event outcome",
        reportImpact: "Needs review",
        calendarEvent: event,
        priority: 1,
        priorityScore: hoursUntil <= -24 ? 70 : 45,
        priorityReasons: ["event passed without an outcome"],
      }];
    }
    if (hoursUntil >= 0 && hoursUntil <= 24 && event.confirmationStatus === "Pending" && /screen|interview|offer call|orientation/i.test(event.eventType)) {
      return [{
        id: `calendar-confirmation:${event.id}`,
        sourceType: "calendar",
        sourceId: event.id,
        candidateId: event.candidateId,
        requisitionId: event.requisitionId,
        candidateName: event.candidateName || event.title,
        position: event.position || "Position not assigned",
        facilityName: event.facilityName || "Facility not assigned",
        title: "Confirm upcoming event",
        category: "Do Now",
        filters: ["Do Now"],
        ownerType: "Recruiter",
        ownerLabel: event.recruiterName || "Recruiter",
        riskLevel: "Medium",
        riskReason: `${event.eventType} starts within 24 hours and confirmation is pending.`,
        reason: `${event.eventType} is approaching and still needs confirmation.`,
        dueAt: event.startDateTime,
        isOverdue: false,
        daysWaiting: 0,
        estimatedMinutes: 5,
        recommendedAction: "Review and confirm the event",
        reportImpact: "Complete",
        calendarEvent: event,
        priority: 3,
        priorityScore: 35,
        priorityReasons: ["upcoming event confirmation"],
      }];
    }
    return [];
  });
}

export function calendarEventsMissingOutcomes(events = [], now = new Date()) {
  const current = validDate(now) || new Date();
  return events.map(normalizeInternalCalendarEvent).filter((event) => event.eventStatus !== "Canceled" && validDate(event.endDateTime) < current && event.outcomeStatus === "Pending");
}

function escapeIcs(value) {
  return text(value).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function icsDate(value) {
  const date = validDate(value);
  return date ? date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z") : "";
}

export function buildInternalCalendarInvitation(event = {}) {
  const normalized = normalizeInternalCalendarEvent(event);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//WelcomeFlow//Internal Recruiting Calendar//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${escapeIcs(normalized.id)}@welcomeflow.internal`,
    `DTSTAMP:${icsDate(normalized.updatedAt)}`,
    `DTSTART:${icsDate(normalized.startDateTime)}`,
    `DTEND:${icsDate(normalized.endDateTime)}`,
    `SUMMARY:${escapeIcs(normalized.title)}`,
    `DESCRIPTION:${escapeIcs(normalized.description)}`,
    `LOCATION:${escapeIcs(normalized.location)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
