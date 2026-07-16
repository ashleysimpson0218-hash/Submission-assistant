const MAX_BODY_CHARS = 12000;

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

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed" });
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
      json(res, response.status, { error: data?.message || data?.error || "Resend could not send the email.", details: data });
      return;
    }
    json(res, 200, { ok: true, id: data?.id || "", provider: "resend" });
  } catch (error) {
    json(res, 500, { error: error?.message || "Email send failed." });
  }
};
