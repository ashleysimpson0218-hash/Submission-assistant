const crypto = require("crypto");
const { need } = require("../../src/workflow/engine");
function signCapability(claims, secret) {
  need(
    typeof secret === "string" && secret.length >= 32,
    "LINKS_UNAVAILABLE",
    "Secure candidate links are not configured.",
    503,
  );
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${body}.${crypto.createHmac("sha256", secret).update(body).digest("base64url")}`;
}
function verifyCapability(token, secret, now = Date.now()) {
  try {
    need(
      secret?.length >= 32 && typeof token === "string" && token.length < 3000,
      "INVALID_LINK",
      "This link is invalid.",
      403,
    );
    const [body, signature, ...extra] = token.split("."),
      expected = crypto
        .createHmac("sha256", secret)
        .update(body)
        .digest("base64url");
    need(
      !extra.length &&
        signature?.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected)),
      "INVALID_LINK",
      "This link is invalid.",
      403,
    );
    const c = JSON.parse(Buffer.from(body, "base64url").toString());
    need(
      c.expiresAt > now &&
        c.expiresAt <= now + 8 * 86400000 &&
        ["booking", "experience"].includes(c.purpose) &&
        Number.isInteger(c.stageIndex) &&
        c.stageIndex >= 0 &&
        c.caseId &&
        c.workspaceId,
      "LINK_EXPIRED",
      "This link expired. Contact recruiting for a replacement.",
      403,
    );
    return {
      userId: `candidate:${c.caseId}`,
      active: true,
      role: "candidate",
      ...c,
    };
  } catch {
    const e = new Error(
      "This candidate link is invalid or expired. Contact recruiting for help.",
    );
    e.code = "INVALID_LINK";
    e.status = 403;
    throw e;
  }
}
module.exports = { signCapability, verifyCapability };
