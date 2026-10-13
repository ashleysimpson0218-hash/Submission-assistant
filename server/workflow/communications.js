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
function requisitionDetails(r) {
  const [position, facility, jobIdentifier] = String(r.title || "")
    .split("|")
    .map((value) => value.trim());
  return {
    position: position || r.title || "Position not listed",
    facility: facility || "Facility not listed",
    jobIdentifier: jobIdentifier || r.id,
  };
}
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
    return { state: "cancelled", reason: "CANDIDATE_DISPOSITION_EMAIL_DISABLED" };
  } else if (decisionKinds.has(job.kind)) {
    if (
      !["manager_decision", "feedback_due", "held"].includes(c.status) ||
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
      "facility_booking_confirmation",
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
    !["confirmation", "facility_booking_confirmation"].includes(job.kind) &&
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
    if (jobs[0].kind === "decision_reminder") {
      lines.push(
        "Hello Manager,",
        "This is a reminder of candidates currently on hold or already interviewed and awaiting your feedback.",
        "Opening a link below does not record a decision. Review the candidate in WelcomeFlow, then confirm your choice there.",
      );
      const addSection = (title, sectionJobs, options) => {
        if (!sectionJobs.length) return;
        lines.push(title);
        for (const reminderJob of sectionJobs) {
          const entry = eligible(reminderJob, state, members, now);
          if (entry.state !== "ready") continue;
          const details = requisitionDetails(entry.r);
          const note = entry.c.stages
            .flatMap((item) => item.feedback || [])
            .map((feedback) => feedback.text)
            .filter(Boolean)
            .slice(-1)[0] || entry.c.packet || "No additional candidate note recorded.";
          lines.push(
            `Facility: ${details.facility}`,
            `Candidate: ${entry.c.name}`,
            `Position: ${details.position}`,
            `Unique job identifier: ${details.jobIdentifier}`,
            `Candidate note reminder: ${note}`,
            `Available decisions: ${options}`,
          );
          if (currentOwner(entry.c, entry.r) === recipient.userId) {
            const links = managerActions(origin, workspaceId, entry.c);
            actions.push(...links.map((action) => ({ ...action, label: `${entry.c.name}: ${action.label}` })));
            lines.push(...links.map((action) => `${action.label}: ${action.url}`));
          }
        }
      };
      addSection(
        "CANDIDATES CURRENTLY ON HOLD",
        jobs.filter((reminderJob) => eligible(reminderJob, state, members, now).c?.status === "held"),
        "Proceed; Proceed but select your time your way; Continue to hold; Decline to proceed",
      );
      addSection(
        "CANDIDATES INTERVIEWED — FEEDBACK NEEDED",
        jobs.filter((reminderJob) => eligible(reminderJob, state, members, now).c?.status === "feedback_due"),
        "Decline to proceed; Offer position / proceed to offer handoff; Continue to hold",
      );
      lines.push(
        "Offer position records the candidate as ready for the authorized offer handoff. It does not create or send an offer.",
      );
    } else {
    lines.push(
      jobs[0].kind === "decision_escalation"
        ? "Your intervention is requested for overdue interview decisions."
        : "Candidate submission for manager review.",
      "Opening a link below does not record a decision. Review the candidate in WelcomeFlow, then confirm your choice there.",
    );
    for (const j of jobs) {
      const e = eligible(j, state, members, now);
      if (e.state !== "ready") return null;
      if (canReadCase(recipient, r, e.c))
        {
          lines.push(
            `Candidate: ${e.c.name}`,
            `Candidate email: ${e.c.email}`,
            `Opening: ${e.r.title}`,
            `Current review: ${e.stage?.name || "Post-screen manager review"}`,
            `Status: ${e.c.status}`,
            `Requested: ${e.c.decisionRequestedAt || "new request"}`,
          );
          if (e.c.stageIndex === -1 && e.c.packet)
            lines.push(`Reviewed candidate details:\n${e.c.packet}`);
          if (currentOwner(e.c, r) === recipient.userId) {
            const links = managerActions(origin, workspaceId, e.c);
            if (e.c.stageIndex < e.c.stages.length - 1)
              lines.push(
                "Decision paths:",
                "Proceed: review and confirm the connected-calendar scheduling path.",
                "Proceed but select your time your way: enter approved interview times; confirming queues the candidate invitation.",
                "Hold for other candidate review: confirming queues an active-review update to the candidate without promising an interview date.",
                "Decline to proceed: enter a required reason; confirming notifies recruiting first and does not email the candidate.",
              );
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
    }
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
  } else if (jobs[0].kind === "facility_booking_confirmation") {
    const details = requisitionDetails(r);
    lines.push(
      "Hello Manager,",
      "The candidate has selected an interview time and is booked.",
      `Facility: ${details.facility}`,
      `Candidate: ${c.name}`,
      `Position: ${details.position}`,
      `Unique job identifier: ${details.jobIdentifier}`,
      `Interview stage: ${stage.name}`,
      `Interview time: ${date(stage.booking.start)}–${date(stage.booking.end)} (${recipient.timezone})`,
      `Location or joining information: ${stage.location}`,
      "The candidate received a confirmation. Review the booking in WelcomeFlow:",
      `${actionUrl}&case=${encodeURIComponent(c.id)}`,
    );
  } else if (jobs[0].kind === "active_review")
    lines.push(
      `Hello ${c.name},`,
      `Congratulations—your resume for ${requisitionDetails(r).position} is being reviewed by the hiring manager.`,
      "Once the manager provides clear direction, we will be in touch with the next steps.",
      "No interview or hiring decision has been made yet. Please reply to recruiting with any questions or changes to your interest or availability.",
    );
  else if (jobs[0].kind === "recruiter_decline") {
    lines.push(`The manager declined to proceed with ${c.name} for ${r.title}.`,
      `Reason: ${c.lastDecision.reason}`, ...(c.lastDecision.comment ? [`Manager comment: ${c.lastDecision.comment}`] : []),
      "WelcomeFlow recorded the candidate as dispositioned. Update the company ATS using the documented reason and comment. No candidate disposition email was generated.",
      `${actionUrl}&case=${encodeURIComponent(c.id)}`);
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
    const details = requisitionDetails(r);
    lines.push(`Hello ${c.name},`);
    if (purpose === "booking")
      lines.push(
        "You have been invited to schedule an interview.",
        `Position: ${details.position}`,
        `Facility: ${details.facility}`,
        `Unique job identifier: ${details.jobIdentifier}`,
        `Interview stage: ${stage.name}`,
        `Location or joining information: ${stage.location}`,
        "Available interview times:",
        "A WelcomeFlow account is not required, and the secure scheduling link is intended only for you.",
        ...stage.slots.map((slot) => `${date(slot.start)}–${date(slot.end)} (${recipient.timezone})`),
        `Select your interview time: ${origin}/workflow?workspace=${encodeURIComponent(workspaceId)}&token=${encodeURIComponent(token)}`,
        "Please contact recruiting if none of the offered times work or if your availability changes.",
      );
    else
      lines.push(
        "How was your interview? Are you still interested, and do you have unanswered questions or want recruiting/HR follow-up? This is a feedback check-in, not an offer or hiring decision.",
        `${origin}/workflow?workspace=${encodeURIComponent(workspaceId)}&token=${encodeURIComponent(token)}`,
      );
  } else {
    const details = requisitionDetails(r);
    if (jobs[0].kind === "confirmation")
      lines.push(
        `Hello ${c.name},`,
        "Your interview is confirmed.",
        `Position: ${details.position}`,
        `Facility: ${details.facility}`,
        `Unique job identifier: ${details.jobIdentifier}`,
        `Interview stage: ${stage.name}`,
        `Interview time: ${date(stage.booking.start)}–${date(stage.booking.end)} (${recipient.timezone})`,
        `Joining details: ${stage.location}`,
        ...(jobs.some((job) => job.kind === "preparation") ||
        stage.communicationPath === "short_notice_under_24"
          ? [`Preparation information: ${stage.instructions}`]
          : []),
        ...(jobs.some((job) => job.kind === "interview_reminder")
          ? ["This confirmation also includes your interview reminder."]
          : []),
        "The facility has been notified of your selected time. Please contact recruiting with any questions or changes.",
      );
    else
      lines.push(
        `Hello ${c.name},`,
        `${jobs[0].kind === "preparation" ? "Prepare for your interview" : "Interview reminder"}: ${stage.name} | ${date(stage.booking.start)} (${recipient.timezone}).`,
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
    subject: `${jobs[0].kind === "experience" ? "Your interview experience" : jobs[0].kind === "confirmation" ? "Your interview is confirmed" : jobs[0].kind === "manager_interview" ? "Upcoming interview" : jobs[0].kind === "facility_booking_confirmation" ? `Candidate booked | ${c.name}` : jobs[0].kind === "decision_reminder" ? "Manager candidate reminder" : decisionKinds.has(jobs[0].kind) ? "Candidate submission for review" : jobs[0].kind === "recruiter_decline" ? "Manager disposition recorded — ATS update needed" : jobs[0].kind === "active_review" ? "Your resume is being reviewed" : jobs[0].kind === "slot_selection" ? "Choose your interview time" : "Interview update"} | ${r.title}`,
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
