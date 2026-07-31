const CLOUD_TABLE = "welcomeflow_workspace_state";

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function cleanText(value, limit = 500) {
  return String(value || "").replace(/\u0000/g, "").trim().slice(0, limit);
}

function configuredList(name) {
  return String(process.env[name] || "")
    .split(/[;,\s]+/)
    .map((value) => value.trim())
    .filter(Boolean);
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

function isTime(value) {
  const match = String(value || "").match(/^(\d{2}):(\d{2})$/);
  return Boolean(match && Number(match[1]) <= 23 && Number(match[2]) <= 59);
}

function records(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value);
  return [];
}

function publicLead(lead = {}, data = {}) {
  const settings = data.settings || {};
  return {
    id: lead.id || "",
    candidateName: lead.candidateName || "",
    email: lead.email || "",
    phone: lead.phone || "",
    position: lead.appliedPosition || lead.selectedRole || "",
    facility: lead.selectedFacility || "",
    recruiterName: lead.recruiterOwner || settings.general?.recruiterName || "Recruiter",
    companyName: settings.general?.companyName || "the recruiting team",
    externalSchedulingLink: lead.bookingLink || settings.general?.defaultBookingLink || "",
    bookingStatus: lead.bookingStatus || lead.phoneScreenStatus || "Not Scheduled",
    bookedScreeningDate: lead.bookedScreeningDate || "",
    bookedScreeningTime: lead.bookedScreeningTime || "",
    phoneScreenType: lead.phoneScreenType || "Phone",
  };
}

function supabaseClient(req = {}) {
  const { createClient } = require("@supabase/supabase-js");
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_SECRET_KEY
    || process.env.SUPABASE_ANON_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || process.env.REACT_APP_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const authorization = String(req.headers?.authorization || req.headers?.Authorization || "").trim();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(authorization ? { global: { headers: { Authorization: authorization } } } : {}),
  });
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

function validateBookingSource(data = {}, lead = {}, payload = {}) {
  const payloadLeadId = cleanText(payload.leadId || payload.candidateId || "", 120);
  if (payloadLeadId && payloadLeadId !== lead.id) return "The booking request does not match this candidate.";

  const storedRequisitionId = leadRequisitionId(lead);
  const payloadRequisitionId = cleanText(payload.requisitionId || payload.reqId || "", 120);
  if (payloadRequisitionId && payloadRequisitionId !== storedRequisitionId) return "The booking request does not match this requisition.";
  if (storedRequisitionId) {
    const requisitions = records(data.settings?.requisitions);
    if (requisitions.length && !requisitions.some((item) => cleanText(item?.id || item?.requisitionId || "", 120) === storedRequisitionId)) {
      return "The linked requisition is no longer available.";
    }
  }
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

  const leadId = cleanText(req.query?.leadId || req.query?.id || payload.leadId || "", 120);
  if (!leadId) {
    json(res, 400, { error: "Missing lead id." });
    return;
  }

  const client = supabaseClient(req);
  if (!client) {
    json(res, 503, { error: "Cloud booking is not configured." });
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
    const lead = leads.find((item) => item.id === leadId);
    if (!lead) {
      json(res, 404, { error: "This booking link is no longer active." });
      return;
    }

    if (req.method === "GET") {
      json(res, 200, { lead: publicLead(lead, data) });
      return;
    }

    const requestedDate = cleanText(payload.requestedDate || payload.screenDate, 20);
    const requestedTime = cleanText(payload.requestedTime || payload.screenTime, 20);
    const meetingType = cleanText(payload.meetingType || "Phone", 40);
    const notes = cleanText(payload.notes, 1000);
    const timeZone = cleanText(payload.timeZone || "Eastern Time (ET)", 80);
    const preferredContactMethod = cleanText(payload.preferredContactMethod || "", 60);

    if (!isIsoDate(requestedDate) || !isTime(requestedTime)) {
      json(res, 400, { error: "Choose a valid date and time." });
      return;
    }
    const sourceError = validateBookingSource(data, lead, payload);
    if (sourceError) {
      json(res, 409, { error: sourceError });
      return;
    }
    if (duplicateBooking(lead, requestedDate, requestedTime)) {
      json(res, 200, { ok: true, duplicate: true, lead: publicLead(lead, data) });
      return;
    }

    const now = new Date().toISOString();
    const messageSummary = `Candidate requested screen: ${requestedDate} at ${requestedTime} ${timeZone}${preferredContactMethod ? ` | Preferred: ${preferredContactMethod}` : ""}${notes ? ` | Notes: ${notes}` : ""}`;
    const nextLeads = leads.map((item) => {
      if (item.id !== leadId) return item;
      return {
        ...item,
        bookedScreeningDate: requestedDate,
        bookedScreeningTime: requestedTime,
        phoneScreenTimezone: timeZone,
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
          { id: `comm-${Date.now()}`, candidateId: item.id, type: "schedule", direction: "inbound", status: "Scheduling Request Received", messageSummary, timestamp: now, createdBy: item.candidateName || "Candidate", source: "booking_page" },
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
    json(res, 200, { ok: true, duplicate: false, lead: publicLead(nextLeads.find((item) => item.id === leadId), nextWorkspace) });
  } catch (error) {
    console.error("WelcomeFlow booking request failed", { code: error?.code || "", workspaceId });
    json(res, 503, { error: "The booking request could not be completed safely." });
  }
};

module.exports.__test = {
  duplicateBooking,
  isIsoDate,
  isTime,
  saveWorkspaceIfUnchanged,
  validateBookingSource,
  validWorkspaceId,
  workspaceIsAllowed,
};
