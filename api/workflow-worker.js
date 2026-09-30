const crypto = require("crypto");
const {
  readServerRuntimeConfig,
  serviceSupabaseClient,
} = require("../server/welcomeflowApiSecurity");
const { snapshot, execute, SYSTEM } = require("../server/workflow/store");
const {
  eligible,
  deliveryGroups,
  buildMessage,
} = require("../server/workflow/communications");
const { need } = require("../src/workflow/engine");
function authorized(req) {
  const expected = process.env.WELCOMEFLOW_WORKFLOW_WORKER_SECRET,
    provided = String(req.headers?.authorization || "").replace(/^Bearer /, "");
  return (
    expected?.length >= 32 &&
    provided.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
  );
}
function allowedRecipient(email) {
  const list = (name) =>
    String(process.env[name] || "")
      .toLowerCase()
      .split(/[;,\s]+/)
      .filter(Boolean);
  return (
    list("WELCOMEFLOW_EMAIL_ALLOWED_RECIPIENTS").includes(
      email.toLowerCase(),
    ) ||
    list("WELCOMEFLOW_EMAIL_ALLOWED_DOMAINS").includes(
      email.toLowerCase().split("@")[1],
    )
  );
}
module.exports = async function handler(req, res) {
  const send = (status, body) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify(body));
  };
  try {
    need(req.method === "POST", "METHOD", "Use POST.", 405);
    need(
      authorized(req),
      "FORBIDDEN",
      "Worker authorization is required.",
      403,
    );
    need(
      process.env.WELCOMEFLOW_MAINTENANCE_MODE !== "true",
      "MAINTENANCE",
      "Maintenance is active.",
      503,
    );
    const runtime = readServerRuntimeConfig("workflow");
    need(runtime.ok, "DISABLED", runtime.error, 503);
    const workspaceId = String(req.body?.workspaceId || "");
    need(
      String(process.env.WELCOMEFLOW_API_WORKSPACE_IDS || "")
        .split(/[;,\s]+/)
        .includes(workspaceId),
      "FORBIDDEN",
      "Workspace is not enabled.",
      403,
    );
    const client = serviceSupabaseClient(runtime),
      run = async (type, payload) =>
        execute(
          client,
          workspaceId,
          { id: crypto.randomUUID(), type, payload },
          SYSTEM,
        );
    const confirmationCaseId = req.body?.confirmationCaseId;
    if (!confirmationCaseId) await run("tick", {});
    // Timers and recovery are operational even when outbound email is deliberately disabled.
    if (
      process.env.WELCOMEFLOW_UAT_EXTERNAL_ACTIONS_DISABLED === "true" ||
      process.env.WELCOMEFLOW_ENABLE_EMAIL_ACTIONS !== "true"
    )
      return send(200, { ok: true, outbound: "disabled", processed: 0 });
    const origin = process.env.WELCOMEFLOW_PUBLIC_ORIGIN;
    need(
      /^https:\/\/[^/]+$/.test(origin || "") &&
        process.env.RESEND_API_KEY &&
        process.env.RESEND_FROM_EMAIL,
      "DELIVERY_UNCONFIGURED",
      "Email and secure action origin must be configured.",
      503,
    );
    let processed = 0;
    const pending = await snapshot(client, workspaceId);
    const providerIds = [
      ...new Set(
        pending.state.jobs
          .filter(
            (j) =>
              j.status === "provider_accepted" &&
              j.providerId &&
              (!j.providerCheckedAt ||
                Date.now() - Date.parse(j.providerCheckedAt) > 5 * 60000),
          )
          .map((j) => j.providerId),
      ),
    ].slice(0, 5);
    for (const providerId of confirmationCaseId ? [] : providerIds) {
      let outcome = "lookup_unavailable";
      try {
        const response = await fetch(
          `https://api.resend.com/emails/${encodeURIComponent(providerId)}`,
          {
            signal: AbortSignal.timeout(5000),
            headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
          },
        );
        const result = await response.json();
        if (
          response.ok &&
          result.id === providerId &&
          typeof result.last_event === "string"
        )
          outcome = result.last_event;
      } catch {
        /* Provider acceptance stays distinct from delivery during a lookup outage. */
      }
      await run("provider_outcome", { providerId, event: outcome });
    }
    const stopAt = Date.now() + 20000;

    for (
      let i = 0;
      i < (confirmationCaseId ? 1 : 10) && Date.now() < stopAt;
      i += 1
    ) {
      let snap = await snapshot(client, workspaceId),
        now = new Date().toISOString();
      // Suppress obsolete work. Invalid contact/identity remains an owned exception.
      for (const j of snap.state.jobs
        .filter(
          (x) =>
            x.status === "queued" &&
            x.dueAt <= now &&
            (!confirmationCaseId || x.caseId === confirmationCaseId),
        )
        .slice(0, 50)) {
        const check = eligible(j, snap.state, snap.members, now);
        if (["cancelled", "blocked"].includes(check.state))
          await run("block_delivery", {
            jobId: j.id,
            cancelled: check.state === "cancelled",
            reason: check.reason,
          });
      }
      snap = await snapshot(client, workspaceId);
      const group = deliveryGroups(snap.state, snap.members, now).find(
        (g) =>
          !confirmationCaseId ||
          g.jobs.some(
            (j) => j.caseId === confirmationCaseId && j.kind === "confirmation",
          ),
      );
      if (!group) break;
      const leaseId = crypto.randomUUID();
      await run("claim_delivery", {
        jobIds: group.jobs.map((j) => j.id),
        leaseId,
      });
      snap = await snapshot(client, workspaceId);
      now = new Date().toISOString();
      const claimed = {
        ...group,
        jobs: group.jobs.map((j) => snap.state.jobs.find((x) => x.id === j.id)),
      };
      let message;
      try {
        message = buildMessage(claimed, snap.state, snap.members, now, {
          origin,
          workspaceId,
          linkSecret: process.env.WELCOMEFLOW_CANDIDATE_LINK_SECRET,
        });
      } catch {
        await run("record_delivery", {
          jobIds: group.jobs.map((j) => j.id),
          leaseId,
          status: "failed",
          resultCode: "LINK_CONFIGURATION_REQUIRED",
        });
        continue;
      }
      if (!message || !allowedRecipient(message.to)) {
        await run("record_delivery", {
          jobIds: group.jobs.map((j) => j.id),
          leaseId,
          status: message ? "failed" : "cancelled",
          resultCode: message ? "RECIPIENT_NOT_APPROVED" : "CONTEXT_CHANGED",
        });
        continue;
      }
      let status = "unknown",
        providerId = "",
        resultCode = "PROVIDER_RESULT_UNKNOWN",
        retryable = false;
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          signal: AbortSignal.timeout(15000),
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
            "Idempotency-Key": message.idempotencyKey,
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL,
            to: [message.to],
            subject: message.subject,
            text: message.text,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok && data.id) {
          status = "provider_accepted";
          providerId = data.id;
          resultCode = "PROVIDER_ACCEPTED";
        } else if (response.status >= 400 && response.status < 500) {
          status = "failed";
          resultCode = `PROVIDER_REJECTED_${response.status}`;
          retryable = response.status === 429;
        }
        // Server errors and timeouts can follow acceptance. Never blindly replay.
      } catch {
        /* The durable sending lease becomes unknown if result persistence also fails. */
      }
      await run("record_delivery", {
        jobIds: group.jobs.map((j) => j.id),
        leaseId,
        status,
        providerId,
        resultCode,
        retryable,
      });
      processed += 1;
    }
    return send(200, { ok: true, processed });
  } catch (e) {
    return send(e.status || 503, {
      ok: false,
      code: e.code || "WORKER_FAILED",
      error: e.status
        ? e.message
        : "Worker paused. Pending actions remain durable; sending leases require reconciliation.",
    });
  }
};
