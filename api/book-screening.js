const CLOUD_WORKSPACE_ID = "default";
const CLOUD_TABLE = "welcomeflow_workspace_state";

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function cleanText(value, limit = 500) {
  return String(value || "").replace(/\u0000/g, "").trim().slice(0, limit);
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function isTime(value) {
  return /^\d{2}:\d{2}$/.test(String(value || ""));
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

function supabaseClient() {
  const { createClient } = require("@supabase/supabase-js");
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function loadWorkspace(client) {
  const { data, error } = await client
    .from(CLOUD_TABLE)
    .select("data")
    .eq("workspace_id", CLOUD_WORKSPACE_ID)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.data || {};
}

async function saveWorkspace(client, data) {
  const { error } = await client
    .from(CLOUD_TABLE)
    .upsert({ workspace_id: CLOUD_WORKSPACE_ID, data, updated_at: new Date().toISOString() }, { onConflict: "workspace_id" });
  if (error) throw new Error(error.message);
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

  const client = supabaseClient();
  if (!client) {
    json(res, 500, { error: "Cloud booking is not configured." });
    return;
  }

  const leadId = cleanText(req.query?.leadId || req.query?.id || "", 120);
  if (!leadId) {
    json(res, 400, { error: "Missing lead id." });
    return;
  }

  try {
    const data = await loadWorkspace(client);
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

    if (req.method !== "POST") {
      json(res, 405, { error: "Method not allowed." });
      return;
    }

    let payload = {};
    try {
      payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    } catch {
      json(res, 400, { error: "Invalid JSON body." });
      return;
    }

    const requestedDate = cleanText(payload.requestedDate || payload.screenDate, 20);
    const requestedTime = cleanText(payload.requestedTime || payload.screenTime, 20);
    const meetingType = cleanText(payload.meetingType || "Phone", 40);
    const candidateName = cleanText(payload.candidateName || lead.candidateName || "Candidate", 120);
    const candidateEmail = cleanText(payload.candidateEmail || lead.email || "", 160);
    const candidatePhone = cleanText(payload.candidatePhone || lead.phone || "", 80);
    const notes = cleanText(payload.notes, 1000);
    const timeZone = cleanText(payload.timeZone || "Eastern Time (ET)", 80);
    const preferredContactMethod = cleanText(payload.preferredContactMethod || "", 60);
    const now = new Date().toISOString();

    if (!isIsoDate(requestedDate) || !isTime(requestedTime)) {
      json(res, 400, { error: "Choose a valid date and time." });
      return;
    }

    const messageSummary = `Candidate requested screen: ${requestedDate} at ${requestedTime} ${timeZone}${preferredContactMethod ? ` | Preferred: ${preferredContactMethod}` : ""}${notes ? ` | Notes: ${notes}` : ""}`;
    const nextLeads = leads.map((item) => {
      if (item.id !== leadId) return item;
      return {
        ...item,
        candidateName: candidateName || item.candidateName,
        email: candidateEmail || item.email,
        phone: candidatePhone || item.phone,
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
          { id: `comm-${Date.now()}`, candidateId: item.id, type: "schedule", direction: "inbound", status: "Scheduling Request Received", messageSummary, timestamp: now, createdBy: candidateName || "Candidate", source: "booking_page" },
          ...(Array.isArray(item.communicationEvents) ? item.communicationEvents : []),
        ].slice(0, 120),
        outreachHistory: [
          { id: `hotlog-${Date.now()}`, method: "Candidate requested screen time", timestamp: now, status: "Scheduling Request Received", bookedScreeningDate: requestedDate, bookedScreeningTime: requestedTime, countedAttempt: false, source: "booking_page" },
          ...(Array.isArray(item.outreachHistory) ? item.outreachHistory : []),
        ].slice(0, 120),
      };
    });

    await saveWorkspace(client, { ...data, hotLeads: nextLeads, savedAt: now });
    json(res, 200, { ok: true, lead: publicLead(nextLeads.find((item) => item.id === leadId), { ...data, hotLeads: nextLeads }) });
  } catch (error) {
    json(res, 500, { error: error?.message || "Booking request failed." });
  }
};
