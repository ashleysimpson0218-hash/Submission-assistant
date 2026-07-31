const {
  consumeSharedRateLimit,
  opaqueSubject,
  requestIp,
  serviceSupabaseClient,
} = require("../server/welcomeflowApiSecurity");

const CLOUD_TABLE = "welcomeflow_workspace_state";
const BOOKING_TOKEN_PATTERN = /^[a-f0-9]{64}$/i;
const MEETING_TYPES = new Set(["Phone", "Teams", "Zoom"]);
const CONTACT_METHODS = new Set(["Phone", "Email", "Text"]);

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function cleanText(value, limit = 500) {
  // The NUL match is intentional: reject control-byte injection at the API boundary.
  // eslint-disable-next-line no-control-regex
  return String(value || "").replace(/\u0000/g, "").trim().slice(0, limit);
}

function configuredList(name) {
  return String(process.env[name] || "")
    .split(/[;,\s]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function positiveInteger(value, fallback, maximum = 1000) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

function validWorkspaceId(value) {
  return /^[a-z0-9][a-z0-9_-]{0,79}$/i.test(String(value || ""));
}

function workspaceIsAllowed(workspaceId) {
  return configuredList("WELCOMEFLOW_BOOKING_WORKSPACE_IDS").includes(workspaceId);
}

function isIsoDate(value) {
  const text = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const [year, month, day] = text.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function records(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value);
  return [];
}

function publicLead(lead = {}, data = {}, allowedSlots = [], timeZone = "") {
  const settings = data.settings || {};
  return {
    position: lead.appliedPosition || lead.selectedRole || "",
    facility: lead.selectedFacility || "",
    recruiterName: lead.recruiterOwner || settings.general?.recruiterName || "Recruiter",
    companyName: settings.general?.companyName || "the recruiting team",
    externalSchedulingLink: lead.bookingLink || settings.general?.defaultBookingLink || "",
    bookingStatus: lead.bookingStatus || lead.phoneScreenStatus || "Not Scheduled",
    bookedScreeningDate: lead.bookedScreeningDate || "",
    bookedScreeningTime: lead.bookedScreeningTime || "",
    phoneScreenType: lead.phoneScreenType || "Phone",
    allowedSlots,
    timeZone,
  };
}

async function loadWorkspace(client, workspaceId) {
  const { data, error } = await client
    .from(CLOUD_TABLE)
    .select("data,updated_at")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function saveWorkspaceIfUnchanged(client, workspaceId, expectedUpdatedAt, data, nextUpdatedAt) {
  const { data: saved, error } = await client
    .from(CLOUD_TABLE)
    .update({ data, updated_at: nextUpdatedAt })
    .eq("workspace_id", workspaceId)
    .eq("updated_at", expectedUpdatedAt)
    .select("updated_at")
    .maybeSingle();
  if (error) throw error;
  return saved || null;
}

function leadRequisitionId(lead = {}) {
  return cleanText(lead.requisitionId || lead.selectedRequisitionId || lead.reqId || lead.workingRequisitionId || "", 120);
}

function activeRequisitionForLead(data = {}, lead = {}) {
  const requisitionId = leadRequisitionId(lead);
  if (!requisitionId) return null;
  return records(data.settings?.requisitions).find((item) => (
    cleanText(item?.id || item?.requisitionId || "", 120) === requisitionId
    && String(item?.status || "Active").trim().toLowerCase() === "active"
  )) || null;
}

function dateKeyInTimeZone(value, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function daysFromToday(dateKey, timeZone, now = new Date()) {
  const todayKey = dateKeyInTimeZone(now, timeZone);
  const toUtcDay = (key) => {
    const [year, month, day] = key.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((toUtcDay(dateKey) - toUtcDay(todayKey)) / 86400000);
}

function bookingConfiguration() {
  const timeZone = cleanText(process.env.WELCOMEFLOW_BOOKING_TIME_ZONE, 80);
  const allowedSlots = configuredList("WELCOMEFLOW_BOOKING_ALLOWED_SLOTS").filter((value) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value));
  try {
    if (!timeZone || dateKeyInTimeZone(new Date(), timeZone) === "") return null;
  } catch {
    return null;
  }
  if (!allowedSlots.length) return null;
  return {
    allowedSlots: Array.from(new Set(allowedSlots)),
    maxDaysAhead: positiveInteger(process.env.WELCOMEFLOW_BOOKING_MAX_DAYS_AHEAD, 60, 365),
    timeZone,
  };
}

function activeBookingLead(leads, token, now = new Date()) {
  const lead = leads.find((item) => item?.bookingAccessToken === token);
  if (!lead || lead.archivedAt || lead.status === "Archived") return null;
  const expiresAt = Date.parse(lead.bookingAccessExpiresAt || "");
  if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) return null;
  return lead;
}

function validBookingRequest({ data, lead, payload, configuration, now = new Date() }) {
  if (!activeRequisitionForLead(data, lead)) return "The linked requisition is no longer active.";
  const requestedDate = cleanText(payload.requestedDate || payload.screenDate, 20);
  const requestedTime = cleanText(payload.requestedTime || payload.screenTime, 20);
  if (!isIsoDate(requestedDate) || !configuration.allowedSlots.includes(requestedTime)) return "Choose an available date and time.";
  const daysAhead = daysFromToday(requestedDate, configuration.timeZone, now);
  if (daysAhead < 0 || daysAhead > configuration.maxDaysAhead) return "Choose a date within the available booking window.";
  const meetingType = cleanText(payload.meetingType || "Phone", 40);
  if (!MEETING_TYPES.has(meetingType)) return "Choose a supported meeting type.";
  const preferredContactMethod = cleanText(payload.preferredContactMethod || "", 60);
  if (preferredContactMethod && !CONTACT_METHODS.has(preferredContactMethod)) return "Choose a supported contact method.";
  return "";
}

function duplicateBooking(lead = {}, requestedDate = "", requestedTime = "") {
  return lead.bookedScreeningDate === requestedDate
    && lead.bookedScreeningTime === requestedTime
    && ["Requested", "Scheduling Request Received"].includes(lead.bookingStatus || lead.phoneScreenStatus);
}

module.exports = async function handler(req, res) {
  if (process.env.WELCOMEFLOW_UAT_EXTERNAL_ACTIONS_DISABLED === "true") {
    json(res, 503, { error: "Booking is disabled in Owner UAT." });
    return;
  }
  if (process.env.WELCOMEFLOW_MAINTENANCE_MODE === "true") {
    json(res, 503, { error: "WelcomeFlow is temporarily unavailable." });
    return;
  }
  if (!["GET", "POST"].includes(req.method)) {
    json(res, 405, { error: "Method not allowed." });
    return;
  }

  let payload = {};
  if (req.method === "POST") {
    try {
      payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    } catch {
      json(res, 400, { error: "Invalid JSON body." });
      return;
    }
  }

  const workspaceId = cleanText(req.query?.workspaceId || req.query?.workspace || payload.workspaceId || "", 80);
  if (!validWorkspaceId(workspaceId) || !workspaceIsAllowed(workspaceId)) {
    json(res, 403, { error: "This booking workspace is not approved." });
    return;
  }
  const token = cleanText(req.query?.token || req.query?.id || payload.token || "", 80);
  if (!BOOKING_TOKEN_PATTERN.test(token)) {
    json(res, 404, { error: "This booking link is no longer active." });
    return;
  }
  const configuration = bookingConfiguration();
  const client = serviceSupabaseClient();
  if (!client || !configuration) {
    json(res, 503, { error: "Cloud booking is not configured safely." });
    return;
  }

  const rateLimit = await consumeSharedRateLimit({
    action: "book-screening",
    subject: opaqueSubject(`ip:${requestIp(req)}`),
    limit: positiveInteger(process.env.WELCOMEFLOW_BOOKING_RATE_LIMIT_PER_MINUTE, 30, 300),
    windowSeconds: 60,
  });
  if (rateLimit.unavailable) {
    json(res, 503, { error: "Booking protection is temporarily unavailable." });
    return;
  }
  if (!rateLimit.ok) {
    json(res, 429, { error: "Too many booking requests. Try again shortly." });
    return;
  }

  try {
    const workspace = await loadWorkspace(client, workspaceId);
    if (!workspace?.data || !workspace.updated_at) {
      json(res, 404, { error: "This booking workspace is unavailable." });
      return;
    }
    const data = workspace.data;
    const leads = Array.isArray(data.hotLeads) ? data.hotLeads : [];
    const lead = activeBookingLead(leads, token);
    if (!lead || !activeRequisitionForLead(data, lead)) {
      json(res, 404, { error: "This booking link is no longer active." });
      return;
    }

    if (req.method === "GET") {
      json(res, 200, { lead: publicLead(lead, data, configuration.allowedSlots, configuration.timeZone) });
      return;
    }

    const validationError = validBookingRequest({ data, lead, payload, configuration });
    if (validationError) {
      json(res, 400, { error: validationError });
      return;
    }
    const requestedDate = cleanText(payload.requestedDate || payload.screenDate, 20);
    const requestedTime = cleanText(payload.requestedTime || payload.screenTime, 20);
    const meetingType = cleanText(payload.meetingType || "Phone", 40);
    const notes = cleanText(payload.notes, 1000);
    const preferredContactMethod = cleanText(payload.preferredContactMethod || "", 60);
    if (duplicateBooking(lead, requestedDate, requestedTime)) {
      json(res, 200, { ok: true, duplicate: true, lead: publicLead(lead, data, configuration.allowedSlots, configuration.timeZone) });
      return;
    }

    const now = new Date().toISOString();
    const messageSummary = `Candidate requested screen: ${requestedDate} at ${requestedTime} ${configuration.timeZone}${preferredContactMethod ? ` | Preferred: ${preferredContactMethod}` : ""}${notes ? ` | Notes: ${notes}` : ""}`;
    const nextLeads = leads.map((item) => {
      if (item.id !== lead.id) return item;
      return {
        ...item,
        bookedScreeningDate: requestedDate,
        bookedScreeningTime: requestedTime,
        phoneScreenTimezone: configuration.timeZone,
        phoneScreenType: meetingType,
        phoneScreenStatus: "Scheduling Request Received",
        bookingStatus: "Requested",
        candidateInterested: "Responded",
        candidateInterestStatus: "Scheduling Request Received",
        candidateAvailability: `${requestedDate} ${requestedTime}`,
        preferredContactMethod: preferredContactMethod || item.preferredContactMethod || "",
        outreachStatus: "Candidate Requested Screen",
        outreachStopReason: "Candidate requested screening time",
        nextAction: "Recruiter confirm screen",
        updatedAt: now,
        lastCandidateResponseAt: now,
        communicationEvents: [
          { id: `comm-${Date.now()}`, candidateId: item.id, type: "schedule", direction: "inbound", status: "Scheduling Request Received", messageSummary, timestamp: now, createdBy: "Candidate", source: "booking_page" },
          ...(Array.isArray(item.communicationEvents) ? item.communicationEvents : []),
        ].slice(0, 120),
        outreachHistory: [
          { id: `hotlog-${Date.now()}`, method: "Candidate requested screen time", timestamp: now, status: "Scheduling Request Received", bookedScreeningDate: requestedDate, bookedScreeningTime: requestedTime, countedAttempt: false, source: "booking_page" },
          ...(Array.isArray(item.outreachHistory) ? item.outreachHistory : []),
        ].slice(0, 120),
      };
    });

    const nextWorkspace = { ...data, hotLeads: nextLeads, savedAt: now };
    const saved = await saveWorkspaceIfUnchanged(client, workspaceId, workspace.updated_at, nextWorkspace, now);
    if (!saved) {
      json(res, 409, { error: "The recruiter workspace changed while this request was being saved. Reload the booking link and try again." });
      return;
    }
    json(res, 200, { ok: true, duplicate: false, lead: publicLead(nextLeads.find((item) => item.id === lead.id), nextWorkspace, configuration.allowedSlots, configuration.timeZone) });
  } catch (error) {
    console.error("WelcomeFlow booking request failed", { code: error?.code || "", workspaceId });
    json(res, 503, { error: "The booking request could not be completed safely." });
  }
};

module.exports.__test = {
  activeBookingLead,
  activeRequisitionForLead,
  bookingConfiguration,
  daysFromToday,
  duplicateBooking,
  isIsoDate,
  publicLead,
  saveWorkspaceIfUnchanged,
  validBookingRequest,
  validWorkspaceId,
  workspaceIsAllowed,
};
