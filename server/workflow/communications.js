const {
  withinWindow,
  zoneValid,
  member,
  canReadCase,
  canManage,
  currentOwner,
} = require("../../src/workflow/engine");
const { signCapability } = require("./capabilities");
const crypto = require("crypto");
const { managerActions, messageHtml } = require("./managerActions");
const terminal = new Set(["declined", "withdrawn", "offer_ready"]);
const decisionKinds = new Set([
  "decision_request",
  "decision_reminder",
  "decision_escalation",
]);
function eligible(job, state, members, now) {
  const c = state.cases.find((x) => x.id === job.caseId),
    r = state.requisitions.find((x) => x.id === job.requisitionId),
    stage = c?.stages[job.stageIndex];
  if (!c || !r?.active || c.status === "withdrawn")
    return { state: "cancelled", reason: "CONTEXT_CLOSED" };
  if (job.kind === "experience") {
    if (!stage?.completedAt || stage.experience)
      return { state: "cancelled", reason: "EXPERIENCE_RESOLVED" };
  } else if (job.kind === "recruiter_decline") {
    if (c.status !== "declined" || job.recipientId !== c.recruiterId)
      return { state: "cancelled", reason: "DECLINE_CHANGED" };
  } else if (job.kind === "candidate_decline") {
    if (c.status !== "declined" || c.declineFollowUp?.channel !== "welcomeflow")
      return { state: "cancelled", reason: "DECLINE_FOLLOW_UP_CHANGED" };
  } else if (decisionKinds.has(job.kind)) {
    if (
      !["manager_decision", "feedback_due"].includes(c.status) ||
      c.stageIndex !== job.stageIndex
    )
      return { state: "cancelled", reason: "DECISION_RESOLVED" };
  } else if (job.kind === "active_review") {
    if (c.status !== "held" || c.stageIndex !== job.stageIndex)
      return { state: "cancelled", reason: "HOLD_RESOLVED" };
  } else if (job.kind === "slots_request" || job.kind === "slot_selection") {
    if (
      c.stageIndex !== job.stageIndex ||
      c.status !==
        (job.kind === "slots_request" ? "slots_needed" : "selection_pending")
    )
      return { state: "cancelled", reason: "SCHEDULING_CHANGED" };
  } else if (
    [
      "confirmation",
      "preparation",
      "interview_reminder",
      "manager_interview",
    ].includes(job.kind)
  ) {
    if (
      !stage?.booking ||
      stage.completedAt ||
      stage.booking.start <= now ||
      terminal.has(c.status)
    )
      return { state: "cancelled", reason: "INTERVIEW_CHANGED" };
  }
  const recipient =
    job.recipientId === "candidate"
      ? { email: c.email, timezone: c.timezone }
      : member(members, job.recipientId);
  if (!recipient?.email || !zoneValid(recipient.timezone))
    return { state: "blocked", reason: "RECIPIENT_UNVERIFIED" };
  if (job.recipientId === "candidate" && !member(members, c.recruiterId)?.email)
    return { state: "blocked", reason: "RECRUITER_REPLY_ROUTE_REQUIRED" };
  if (job.recipientId === "candidate" && !c.contactAllowed)
    return { state: "blocked", reason: "CONTACT_PERMISSION_REQUIRED" };
  if (
    job.recipientId !== "candidate" &&
    job.kind !== "decision_escalation" &&
    !canReadCase(recipient, r, c)
  )
    return { state: "cancelled", reason: "RECIPIENT_UNAUTHORIZED" };
  if (
    decisionKinds.has(job.kind) &&
    job.kind !== "decision_escalation" &&
    currentOwner(c, r) !== job.recipientId
  )
    return { state: "cancelled", reason: "OWNER_CHANGED" };
  if (
    job.kind === "decision_escalation" &&
    state.policy.fallbackOwnerId !== job.recipientId
  )
    return { state: "cancelled", reason: "ESCALATION_OWNER_CHANGED" };
  if (
    job.kind !== "confirmation" &&
    !withinWindow(now, recipient.timezone, state.policy)
  )
    return { state: "waiting", reason: "SEND_WINDOW" };
  return { state: "ready", recipient, c, r, stage };
}
function deliveryGroups(state, members, now) {
  const groups = new Map();
  for (const j of state.jobs.filter(
    (x) => x.status === "queued" && x.dueAt <= now,
  )) {
    const e = eligible(j, state, members, now);
    const key = decisionKinds.has(j.kind)
      ? `${j.requisitionId}:${j.recipientId}:${j.kind === "decision_escalation" ? "escalation" : "decisions"}`
      : j.recipientId === "candidate" &&
          ["confirmation", "preparation", "interview_reminder"].includes(j.kind)
        ? `${j.caseId}:${j.stageIndex}:candidate-interview`
        : j.id;
    if (!groups.has(key)) groups.set(key, { key, jobs: [], eligibility: e });
    if (e.state === "ready") groups.get(key).jobs.push(j);
  }
  return [...groups.values()].filter((g) => g.jobs.length);
}
function buildMessage(
  group,
  state,
  members,
  now,
  { origin, workspaceId, linkSecret },
) {
  const jobs = group.jobs,
    first = eligible(jobs[0], state, members, now);
  if (first.state !== "ready") return null;
  if (jobs.some((j) => eligible(j, state, members, now).state !== "ready"))
    return null;
  const { c, r, recipient, stage } = first,
    lines = [],
    actions = [];
  const actionUrl = `${origin}/workflow?workspace=${encodeURIComponent(workspaceId)}`;
  const date = (iso) =>
    new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: recipient.timezone,
    }).format(new Date(iso));
  if (decisionKinds.has(jobs[0].kind)) {
    lines.push(
      jobs[0].kind === "decision_escalation"
        ? "Your intervention is requested for overdue interview decisions."
        : "Please review these outstanding interview decisions.",
    );
    for (const j of jobs) {
      const e = eligible(j, state, members, now);
      if (e.state !== "ready") return null;
      if (canReadCase(recipient, r, e.c))
        {
          lines.push(`${e.c.name} | ${e.stage?.name || "Post-screen review"} | ${e.c.status} | Requested: ${e.c.decisionRequestedAt || "new request"}`);
          if (e.c.stageIndex === -1 && e.c.packet) lines.push(e.c.packet);
          if (currentOwner(e.c, r) === recipient.userId) {
            const links = managerActions(origin, workspaceId, e.c);
            actions.push(...links.map(a => ({...a, label: jobs.length > 1 ? `${e.c.name}: ${a.label}` : a.label})));
            lines.push(...links.map(a => `${a.label}: ${a.url}`));
          }
        }
    }
    if (!canReadCase(recipient, r, c))
      lines.push(
        `${jobs.length} outstanding items require an authorized owner’s attention.`,
      );
    lines.push(
      "Each candidate needs an individual decision. Supporting feedback does not decide for the stage owner.",
      actionUrl,
    );
  } else if (jobs[0].kind === "slots_request")
    lines.push(
      `Please provide interview slots for ${c.name}: ${stage.name}.`,
      actionUrl,
    );
  else if (jobs[0].kind === "manager_interview") {
    lines.push(
      `Upcoming interview: ${c.name} | ${stage.name} | ${date(stage.booking.start)}`,
    );
    if (canManage(recipient, r) || recipient.role === "admin")
      for (const other of state.cases.filter((x) => x.requisitionId === r.id)) {
        const summary = other.stages
          .flatMap((s) => s.feedback.map((f) => f.text))
          .slice(-2)
          .join(" / ")
          .slice(0, 400);
        lines.push(
          `${other.name}: ${other.status}${summary ? ` | Previously recorded feedback: ${summary}` : ""}${other.finalReason ? ` | Outcome reason: ${other.finalReason}` : ""}`,
        );
      }
    lines.push(actionUrl);
  } else if (jobs[0].kind === "active_review")
    lines.push(
      `Hello ${c.name},`,
      `Good news: your resume for ${r.title} is being actively reviewed by the hiring manager alongside other candidates.`,
      "No interview or hiring decision has been made yet. Your recruiter will share the next update. Please reply to recruiting with any questions or changes to your interest or availability.",
    );
  else if (jobs[0].kind === "recruiter_decline") {
    lines.push(`The manager declined to proceed with ${c.name} for ${r.title}.`,
      `Reason: ${c.lastDecision.reason}`, ...(c.lastDecision.comment ? [`Manager comment: ${c.lastDecision.comment}`] : []),
      "Choose candidate follow-up in WelcomeFlow, or handle it in your company's ATS. Internal manager feedback is for recruiting only.",
      `${actionUrl}&case=${encodeURIComponent(c.id)}&action=decline-follow-up`);
  } else if (jobs[0].kind === "candidate_decline") {
    lines.push(`Hello ${c.name},`, `Thank you for your interest in ${r.title}. The hiring team has decided not to move forward with your application for this opportunity.`,
      "Please contact your recruiter with any questions. Thank you for the time you invested in the process.");
  }
  else if (jobs[0].kind === "slot_selection" || jobs[0].kind === "experience") {
    const purpose = jobs[0].kind === "experience" ? "experience" : "booking";
    const token = signCapability(
      {
        workspaceId,
        caseId: c.id,
        linkVersion: c.linkVersion,
        stageIndex: jobs[0].stageIndex,
        purpose,
        expiresAt: Date.parse(now) + 7 * 86400000,
      },
      linkSecret,
    );
    lines.push(
      `Hello ${c.name},`,
      purpose === "booking"
        ? `Please choose an offered time for your ${stage.name} interview.`
        : "How was your interview? Are you still interested, and do you have unanswered questions or want recruiting/HR follow-up? This is a feedback check-in, not an offer or hiring decision.",
      `${origin}/workflow?workspace=${encodeURIComponent(workspaceId)}&token=${encodeURIComponent(token)}`,
    );
  } else {
    lines.push(
      `Hello ${c.name},`,
      `${jobs[0].kind === "preparation" ? "Prepare for your interview" : jobs[0].kind === "confirmation" ? "Your interview is confirmed" : "Interview reminder"}: ${stage.name} | ${date(stage.booking.start)} (${recipient.timezone}).`,
      `Joining details: ${stage.location}`,
      ...(jobs.some((j) => j.kind === "preparation") ||
      stage.communicationPath === "short_notice_under_24"
        ? [`Joining details and preparation: ${stage.instructions}`]
        : []),
      ...(jobs.some((j) => j.kind === "interview_reminder")
        ? ["This message also includes your interview reminder."]
        : []),
      "Please contact recruiting with any questions or changes.",
    );
  }
  return {
    to: recipient.email,
    subject: `${jobs[0].kind === "experience" ? "Your interview experience" : jobs[0].kind === "manager_interview" ? "Upcoming interview" : decisionKinds.has(jobs[0].kind) ? "Interview decisions needed" : jobs[0].kind === "recruiter_decline" ? "Manager declined to proceed" : jobs[0].kind === "active_review" ? "Your application is under review" : jobs[0].kind === "slot_selection" ? "Interview invitation" : "Interview update"} | ${r.title}`,
    text: lines.join("\n\n"),
    html: messageHtml(lines.join("\n\n"), actions),
    ...(jobs[0].recipientId === "candidate" ? {replyTo: member(members, c.recruiterId).email} : {}),
    idempotencyKey: crypto
      .createHash("sha256")
      .update(
        `${workspaceId}|${jobs
          .map((j) => j.id)
          .sort()
          .join("|")}|${jobs[0].attempts}`,
      )
      .digest("hex"),
  };
}
module.exports = { eligible, deliveryGroups, buildMessage };
