const MAX_BODY_CHARS = 12000;
const MAX_PAYLOAD_BYTES = 64 * 1024;
const MAX_RECIPIENTS = 20;
const {
  authorizedRecruiter,
  consumeSharedRateLimits,
  requestIp,
  requestPayloadBytes,
} = require("../server/welcomeflowApiSecurity");

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
  // The NUL match is intentional: reject control-byte injection at the API boundary.
  // eslint-disable-next-line no-control-regex
  return String(value || "").replace(/\u0000/g, "").trim().slice(0, limit);
}

function configuredList(name) {
  return String(process.env[name] || "")
    .split(/[;,\s]+/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
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

  const authorization = await authorizedRecruiter(req);
  if (!authorization.user) {
    json(res, authorization.unavailable ? 503 : authorization.forbidden ? 403 : 401, { error: authorization.error });
    return;
  }
  const rateLimit = await consumeSharedRateLimits({
    action: "send-email",
    subjects: [`user:${authorization.user.id}`, `ip:${requestIp(req)}`],
    limit: process.env.WELCOMEFLOW_EMAIL_RATE_LIMIT_PER_MINUTE || 10,
    windowSeconds: 60,
  });
  if (rateLimit.unavailable) {
    json(res, 503, { error: rateLimit.error });
    return;
  }
  if (!rateLimit.ok) {
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

  const fromEmail = cleanText(process.env.RESEND_FROM_EMAIL, 120);
  const fromName = cleanText(process.env.RESEND_FROM_NAME || "WelcomeFlow Assistant", 80);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) {
    json(res, 503, { error: "Email sender configuration is unavailable." });
    return;
  }
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
