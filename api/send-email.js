const MAX_BODY_CHARS = 12000;
const MAX_PAYLOAD_BYTES = 64 * 1024;
const MAX_RECIPIENTS = 20;
const RATE_WINDOW_MS = 60 * 1000;
const rateBuckets = new Map();

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function cleanEmailList(value) {
  const values = Array.isArray(value) ? value : String(value || "").split(/[;,]/);
  return values.map((item) => String(item || "").trim()).filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item));
}

function cleanText(value, limit = 500) {
  return String(value || "").replace(/\u0000/g, "").trim().slice(0, limit);
}

function configuredList(name) {
  return String(process.env[name] || "")
    .split(/[;,\s]+/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function bearerToken(req = {}) {
  const value = String(req.headers?.authorization || req.headers?.Authorization || "").trim();
  const match = value.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] || "";
}

function requestPayloadBytes(req = {}) {
  const headerBytes = Number(req.headers?.["content-length"] || req.headers?.["Content-Length"] || 0);
  if (Number.isFinite(headerBytes) && headerBytes > 0) return headerBytes;
  const serialized = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
  return Buffer.byteLength(serialized, "utf8");
}

async function authenticatedUser(req = {}) {
  const token = bearerToken(req);
  if (!token) return { error: "Authorization is required." };

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;
  if (!url || !publishableKey) return { error: "Email authorization is not configured.", unavailable: true };

  try {
    const { createClient } = require("@supabase/supabase-js");
    const client = createClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user?.id) return { error: "Authorization is invalid or expired." };
    return { user: data.user };
  } catch {
    return { error: "Authorization could not be verified.", unavailable: true };
  }
}

function recipientsAreApproved(recipients = []) {
  const exact = new Set(configuredList("WELCOMEFLOW_EMAIL_ALLOWED_RECIPIENTS"));
  const domains = new Set(configuredList("WELCOMEFLOW_EMAIL_ALLOWED_DOMAINS").map((value) => value.replace(/^@/, "")));
  if (!exact.size && !domains.size) return { ok: false, unconfigured: true };
  const denied = recipients.filter((email) => {
    const normalized = String(email || "").trim().toLowerCase();
    const domain = normalized.split("@")[1] || "";
    return !exact.has(normalized) && !domains.has(domain);
  });
  return { ok: denied.length === 0, deniedCount: denied.length };
}

function withinRateLimit(userId, now = Date.now()) {
  const configuredLimit = Number(process.env.WELCOMEFLOW_EMAIL_RATE_LIMIT_PER_MINUTE || 10);
  const limit = Number.isFinite(configuredLimit) && configuredLimit > 0 ? Math.floor(configuredLimit) : 10;
  const prior = (rateBuckets.get(userId) || []).filter((timestamp) => now - timestamp < RATE_WINDOW_MS);
  if (prior.length >= limit) {
    rateBuckets.set(userId, prior);
    return false;
  }
  rateBuckets.set(userId, [...prior, now]);
  return true;
}

module.exports = async function handler(req, res) {
  if (process.env.WELCOMEFLOW_UAT_EXTERNAL_ACTIONS_DISABLED === "true") {
    json(res, 503, { error: "Outbound communication is disabled in Owner UAT." });
    return;
  }
  if (process.env.WELCOMEFLOW_MAINTENANCE_MODE === "true") {
    json(res, 503, { error: "WelcomeFlow is temporarily unavailable." });
    return;
  }

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  if (requestPayloadBytes(req) > MAX_PAYLOAD_BYTES) {
    json(res, 413, { error: "Email request is too large." });
    return;
  }

  const authorization = await authenticatedUser(req);
  if (!authorization.user) {
    json(res, authorization.unavailable ? 503 : 401, { error: authorization.error });
    return;
  }
  if (!withinRateLimit(authorization.user.id)) {
    json(res, 429, { error: "Too many email requests. Try again shortly." });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    json(res, 500, { error: "Email sending is not configured. Add RESEND_API_KEY in Vercel environment variables." });
    return;
  }

  let payload = {};
  try {
    payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  } catch (error) {
    json(res, 400, { error: "Invalid JSON body." });
    return;
  }

  const to = cleanEmailList(payload.to);
  const cc = cleanEmailList(payload.cc);
  const bcc = cleanEmailList(payload.bcc);
  const replyTo = cleanEmailList(payload.replyTo || payload.reply_to);
  const subject = cleanText(payload.subject, 200);
  const text = cleanText(payload.text || payload.body, MAX_BODY_CHARS);
  const html = payload.html ? cleanText(payload.html, MAX_BODY_CHARS * 2) : "";

  if (!to.length) {
    json(res, 400, { error: "At least one valid recipient is required." });
    return;
  }
  const allRecipients = [...to, ...cc, ...bcc, ...replyTo];
  if (allRecipients.length > MAX_RECIPIENTS) {
    json(res, 400, { error: `No more than ${MAX_RECIPIENTS} recipients are allowed.` });
    return;
  }
  const recipientPolicy = recipientsAreApproved(allRecipients);
  if (recipientPolicy.unconfigured) {
    json(res, 503, { error: "Email recipient policy is not configured." });
    return;
  }
  if (!recipientPolicy.ok) {
    json(res, 403, { error: "One or more recipients are not approved for WelcomeFlow email." });
    return;
  }
  if (!subject || (!text && !html)) {
    json(res, 400, { error: "Subject and message body are required." });
    return;
  }

  const fromEmail = cleanText(process.env.RESEND_FROM_EMAIL || "assistant@welcomeflowhq.com", 120);
  const fromName = cleanText(process.env.RESEND_FROM_NAME || "WelcomeFlow Assistant", 80);
  const from = `${fromName} <${fromEmail}>`;

  const resendPayload = {
    from,
    to,
    subject,
    text,
  };
  if (html) resendPayload.html = html;
  if (cc.length) resendPayload.cc = cc;
  if (bcc.length) resendPayload.bcc = bcc;
  if (replyTo.length) resendPayload.reply_to = replyTo;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(resendPayload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("WelcomeFlow email provider rejected a request", { status: response.status, userId: authorization.user.id });
      json(res, 502, { error: "The email provider could not complete this request." });
      return;
    }
    json(res, 200, { ok: true, id: data?.id || "", provider: "resend" });
  } catch (error) {
    console.error("WelcomeFlow email provider request failed", { userId: authorization.user.id });
    json(res, 502, { error: "The email provider could not complete this request." });
  }
};

module.exports.__resetRateLimitsForTests = () => rateBuckets.clear();
