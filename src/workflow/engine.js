/* Revision 5 workflow rules shared by the protected API and local acceptance tests.
 * No network calls, credentials, or browser persistence belong in this module. */
const clone = (x) => JSON.parse(JSON.stringify(x));
const clean = (x, max = 1000) =>
  String(x ?? "")
    .trim()
    .slice(0, max);
const isId = (x) =>
  typeof x === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,239}$/.test(x);
const terminal = new Set(["declined", "withdrawn", "offer_ready"]);
const deliveryFinal = new Set([
  "provider_accepted",
  "delivered",
  "manually_confirmed",
  "cancelled",
]);
const HOUR = 3600000;
function fail(code, message, status = 409) {
  const e = new Error(message);
  e.code = code;
  e.status = status;
  throw e;
}
function need(test, code, message, status) {
  if (!test) fail(code, message, status);
}
function validTime(x) {
  return typeof x === "string" && Number.isFinite(Date.parse(x));
}
function zoneValid(zone) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone }).format(0);
    return Boolean(zone);
  } catch {
    return false;
  }
}
function localParts(now, zone) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(now))
      .map((v) => [v.type, v.value]),
  );
  return {
    day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday),
    minute: Number(p.hour) * 60 + Number(p.minute),
  };
}
function withinWindow(now, zone, policy) {
  if (!zoneValid(zone)) return false;
  const p = localParts(now, zone);
  return (
    policy.workingDays.includes(p.day) &&
    p.minute >= policy.sendStart &&
    p.minute < policy.sendEnd
  );
}
function addWorkingDays(now, days, policy) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: policy.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const wall = (at) => {
    const p = Object.fromEntries(
      formatter.formatToParts(new Date(at)).map((v) => [v.type, v.value]),
    );
    return Date.UTC(
      +p.year,
      +p.month - 1,
      +p.day,
      +p.hour,
      +p.minute,
      +p.second,
    );
  };
  const working = [...new Set(policy.workingDays)];
  const weeks = Math.floor((days - 1) / working.length);
  let target = wall(Date.parse(now)) + weeks * 7 * 86400000,
    remaining = days - weeks * working.length;
  need(
    Number.isFinite(target) && Math.abs(target) < 8640000000000000,
    "CALENDAR_INVALID",
    "The configured deadline exceeds the supported date range.",
    400,
  );
  while (remaining > 0) {
    target += 86400000;
    if (working.includes(new Date(target).getUTCDay())) remaining -= 1;
  }
  // Solve the target wall-clock time in the client timezone; preserve local time across DST.
  let guess = target,
    previous = guess;
  for (let i = 0; i < 5; i += 1) {
    const next = guess + (target - wall(guess));
    if (next === guess) return new Date(guess).toISOString();
    if (next === previous) return new Date(Math.max(next, guess)).toISOString();
    previous = guess;
    guess = next;
  }
  return new Date(guess).toISOString();
}
function emptyState() {
  return {
    schema: 1,
    revision: 0,
    policy: null,
    requisitions: [],
    cases: [],
    jobs: [],
    exceptions: [],
  };
}
function member(members, id) {
  return members.find((m) => m.userId === id && m.active === true);
}
function canRecruit(actor, req) {
  return (
    actor?.active &&
    (actor.role === "admin" ||
      (actor.role === "recruiter" && req?.recruiterIds.includes(actor.userId)))
  );
}
function canManage(actor, req) {
  return actor?.active && req?.active && req.managerId === actor.userId;
}
function canReadCase(actor, req, c) {
  return Boolean(
    actor?.active &&
    (canRecruit(actor, req) ||
      canManage(actor, req) ||
      (req.active &&
        c.stages.some(
          (s) =>
            s.ownerId === actor.userId ||
            s.interviewerIds.includes(actor.userId),
        ))),
  );
}
function currentOwner(c, req) {
  return c.stageIndex < 0 ? req.managerId : c.stages[c.stageIndex]?.ownerId;
}
function stateView(state, actor, members = []) {
  const requisitions = state.requisitions.filter(
    (r) => canRecruit(actor, r) || canManage(actor, r),
  );
  const cases = state.cases
    .filter((c) =>
      canReadCase(
        actor,
        state.requisitions.find((r) => r.id === c.requisitionId),
        c,
      ),
    )
    .map((c) => {
      const r = state.requisitions.find((x) => x.id === c.requisitionId),
        privileged = canRecruit(actor, r) || canManage(actor, r);
      return {
        ...c,
        email: canRecruit(actor, r) ? c.email : undefined,
        timezone: canRecruit(actor, r) ? c.timezone : undefined,
        stages: c.stages.map((s) =>
          privileged ||
          s.ownerId === actor.userId ||
          s.interviewerIds.includes(actor.userId)
            ? {
                ...s,
                experience: canRecruit(actor, r) ? s.experience : undefined,
              }
            : { id: s.id, name: s.name, status: s.status },
        ),
        canRecruit: canRecruit(actor, r),
        canDecide: r.active && currentOwner(c, r) === actor.userId,
        canParticipate:
          r.active &&
          c.stageIndex >= 0 &&
          [
            c.stages[c.stageIndex].ownerId,
            ...c.stages[c.stageIndex].interviewerIds,
          ].includes(actor.userId),
      };
    });
  const reqIds = new Set(requisitions.map((r) => r.id));
  const exceptions = state.exceptions.filter(
    (e) =>
      e.status !== "resolved" &&
      (actor.role === "admin" ||
        e.ownerId === actor.userId ||
        (actor.role === "recruiter" && reqIds.has(e.requisitionId))),
  );
  const allowedCases = new Set(cases.map((c) => c.id));
  const jobs = state.jobs.filter(
    (j) =>
      actor.role === "admin" ||
      (actor.role === "recruiter" && allowedCases.has(j.caseId)) ||
      (j.recipientId === actor.userId && reqIds.has(j.requisitionId)),
  );
  return {
    revision: state.revision,
    lastWorkerAt: state.lastWorkerAt || null,
    actor: { userId: actor.userId, role: actor.role },
    policy:
      actor.role === "admin"
        ? state.policy
        : state.policy
          ? { version: state.policy.version }
          : null,
    requisitions,
    cases,
    exceptions,
    jobs,
    people: members
      .filter(
        (m) =>
          actor.role === "admin" ||
          cases.some(
            (c) =>
              c.recruiterId === m.userId ||
              c.stages.some(
                (s) =>
                  s.ownerId === m.userId ||
                  s.interviewerIds?.includes(m.userId),
              ),
          ) ||
          exceptions.some((e) => e.ownerId === m.userId),
      )
      .map(({ userId, name }) => ({ userId, name })),
    members:
      actor.role === "admin"
        ? members.map(({ userId, name, role, active }) => ({
            userId,
            name,
            role,
            active,
          }))
        : [],
  };
}
function applyCommand(input, command, context) {
  if (command.type === "proceed_with_slots") {
    const p = command.payload || {};
    const first = applyCommand(input, {...command, type: "decision", payload: {...p, decision: "proceed", schedulingMode: "manager_times"}}, context);
    const c = first.state.cases.find(c => c.id === p.caseId);
    need(c?.status === "slots_needed", "SCHEDULING_NOT_REQUIRED", "The final stage proceeds toward offer handoff, not another interview.", 409);
    const second = applyCommand(first.state, {...command, type: "offer_slots", payload: {...p, expectedVersion: c.version}}, context);
    second.state.revision = input.revision + 1;
    return {state: second.state, events: [...first.events, ...second.events]};
  }
  const state = clone(input),
    { actor, members = [], now } = context;
  need(
    actor?.active && validTime(now),
    "AUTH_REQUIRED",
    "An active authenticated identity is required.",
    403,
  );
  need(
    isId(command.id),
    "INVALID_COMMAND",
    "A stable command ID is required.",
    400,
  );
  const p = command.payload || {},
    events = [];
  const event = (type, reqId = "", caseId = "", details = {}) =>
    events.push({
      type,
      requisitionId: reqId,
      caseId,
      actorId: actor.userId,
      actorRole: actor.role,
      occurredAt: now,
      details,
    });
  const exception = (code, c, req, detail) => {
    const key = `${code}:${c?.id || req?.id || "workspace"}`;
    let e = state.exceptions.find((x) => x.id === key);
    if (!e) {
      e = {
        id: key,
        code,
        caseId: c?.id || "",
        requisitionId: req?.id || "",
        ownerId:
          (code === "DECISION_OVERDUE"
            ? state.policy?.fallbackOwnerId
            : c?.recruiterId) ||
          state.policy?.fallbackOwnerId ||
          actor.userId,
        createdAt: now,
        status: "open",
        detail,
      };
      state.exceptions.push(e);
    } else if (e.status === "resolved") {
      e.status = "open";
      e.detail = detail;
    }
    e.lastOccurredAt = now;
    event("exception.opened", e.requisitionId, e.caseId, {
      exceptionId: key,
      code,
    });
    return e;
  };
  const job = (
    kind,
    c,
    r,
    recipientId,
    stageIndex = c.stageIndex,
    dueAt = now,
    suffix = "",
  ) => {
    const id = `${c.id}:${stageIndex}:${kind}:${suffix}`;
    if (state.jobs.some((j) => j.id === id)) return;
    state.jobs.push({
      id,
      kind,
      caseId: c.id,
      requisitionId: r.id,
      stageIndex,
      recipientId,
      status: "queued",
      dueAt,
      createdAt: now,
      attempts: 0,
    });
  };
  const resolveFor = (caseId, codes) =>
    state.exceptions.forEach((e) => {
      if (
        e.caseId === caseId &&
        codes.includes(e.code) &&
        e.status !== "resolved"
      ) {
        e.status = "resolved";
        e.resolvedAt = now;
        event("exception.resolved", e.requisitionId, e.caseId, {
          exceptionId: e.id,
        });
      }
    });
  const invalidate = (c) =>
    state.jobs.forEach((j) => {
      if (
        j.caseId === c.id &&
        j.status === "queued" &&
        !["experience", "confirmation"].includes(j.kind)
      ) {
        j.status = "cancelled";
        j.completedAt = now;
      }
    });
  if (command.type === "configure_policy") {
    need(
      actor.role === "admin",
      "FORBIDDEN",
      "Only a client administrator can configure policy.",
      403,
    );
    need(
      zoneValid(p.timezone) && member(members, p.fallbackOwnerId),
      "INVALID_POLICY",
      "A verified timezone and active fallback owner are required.",
      400,
    );
    const policy = {
      timezone: p.timezone,
      fallbackOwnerId: p.fallbackOwnerId,
      workingDays: p.workingDays || [1, 2, 3, 4, 5],
      sendStart: p.sendStart ?? 420,
      sendEnd: p.sendEnd ?? 1110,
      reminderDays: p.reminderDays ?? 1,
      escalationDays: p.escalationDays ?? 3,
      checkInHours: p.checkInHours ?? 2,
      sources: {
        requisitions: clean(p.sources?.requisitions, 200),
        calendarAvailability: clean(p.sources?.calendarAvailability, 200),
      },
    };
    need(
      Array.isArray(policy.workingDays) &&
        policy.workingDays.length > 0 &&
        policy.workingDays.every(
          (d) => Number.isInteger(d) && d >= 0 && d <= 6,
        ),
      "INVALID_POLICY",
      "Choose valid working days.",
      400,
    );
    need(
      Number.isInteger(policy.sendStart) &&
        Number.isInteger(policy.sendEnd) &&
        policy.sendStart >= 0 &&
        policy.sendEnd <= 1440 &&
        policy.sendEnd > policy.sendStart,
      "INVALID_POLICY",
      "Choose a valid send window.",
      400,
    );
    need(
      Number.isInteger(policy.reminderDays) &&
        policy.reminderDays > 0 &&
        Number.isSafeInteger(policy.reminderDays) &&
        Number.isInteger(policy.escalationDays) &&
        policy.escalationDays >= policy.reminderDays &&
        Number.isSafeInteger(policy.escalationDays) &&
        Number.isFinite(policy.checkInHours) &&
        policy.checkInHours > 0,
      "INVALID_POLICY",
      "Timing values are invalid.",
      400,
    );
    need(
      policy.sources.requisitions &&
        policy.sources.calendarAvailability &&
        clean(p.reason),
      "INVALID_POLICY",
      "Name the client-designated sources and reason for this policy change.",
      400,
    );
    addWorkingDays(now, policy.escalationDays, policy);
    state.policy = {
      ...policy,
      version: (state.policy?.version || 0) + 1,
      effectiveAt: now,
    };
    event("policy.configured", "", "", {
      version: state.policy.version,
      reason: clean(p.reason),
      policy: state.policy,
    });
  } else if (command.type === "configure_requisition") {
    need(
      actor.role === "admin",
      "FORBIDDEN",
      "Only a client administrator can configure an Interview Plan.",
      403,
    );
    need(
      state.policy &&
        isId(p.id) &&
        member(members, p.managerId) &&
        Array.isArray(p.recruiterIds) &&
        p.recruiterIds.length &&
        p.recruiterIds.every((id) =>
          ["recruiter", "admin"].includes(member(members, id)?.role),
        ),
      "INVALID_PLAN",
      "Choose an existing requisition, manager, and authorized recruiters.",
      400,
    );
    need(
      Array.isArray(p.stages) && p.stages.length > 0 && p.stages.length <= 20,
      "INVALID_PLAN",
      "An Interview Plan needs one or more ordered stages.",
      400,
    );
    const stages = p.stages.map((s, i) => {
      need(
        isId(s.id) && clean(s.name) && member(members, s.ownerId),
        "INVALID_PLAN",
        "Each stage needs a name and one active decision owner.",
        400,
      );
      const interviewerIds = [...new Set(s.interviewerIds || [])];
      need(
        interviewerIds.every((id) => member(members, id)),
        "INVALID_PLAN",
        "An interviewer account is missing or inactive.",
        400,
      );
      return {
        id: s.id,
        name: clean(s.name, 120),
        ownerId: s.ownerId,
        interviewerIds,
        order: i,
      };
    });
    need(
      new Set(stages.map((s) => s.id)).size === stages.length,
      "INVALID_PLAN",
      "Stage identities must be unique.",
      400,
    );
    const previous = state.requisitions.find((r) => r.id === p.id);
    need(
      !previous ||
        !state.cases.some(
          (c) => c.requisitionId === p.id && !terminal.has(c.status),
        ),
      "ACTIVE_PLAN",
      "Resolve active cases before changing their Interview Plan or ownership.",
    );
    const r = {
      id: p.id,
      title: clean(p.title, 160),
      active: true,
      managerId: p.managerId,
      recruiterIds: [...new Set(p.recruiterIds)],
      stages,
      version: (previous?.version || 0) + 1,
    };
    state.requisitions = state.requisitions
      .filter((x) => x.id !== r.id)
      .concat(r);
    event("requisition.configured", r.id);
  } else if (command.type === "set_requisition_active") {
    const r = state.requisitions.find((x) => x.id === p.requisitionId);
    need(
      actor.role === "admin" &&
        r &&
        typeof p.active === "boolean" &&
        clean(p.reason),
      "FORBIDDEN",
      "An administrator and reason are required.",
      403,
    );
    r.active = p.active;
    if (!r.active)
      state.cases.filter((c) => c.requisitionId === r.id).forEach(invalidate);
    event("requisition.status_changed", r.id, "", {
      active: r.active,
      reason: clean(p.reason),
    });
  } else if (command.type === "reassign_requisition_owner") {
    const r = state.requisitions.find((x) => x.id === p.requisitionId);
    need(
      actor.role === "admin" &&
        r?.active &&
        member(members, p.ownerId) &&
        clean(p.reason),
      "FORBIDDEN",
      "An administrator must confirm the replacement requisition owner and reason.",
      403,
    );
    const oldOwner = r.managerId;
    r.managerId = p.ownerId;
    r.version += 1;
    for (const c of state.cases.filter(
      (c) =>
        c.requisitionId === r.id && c.stageIndex < 0 && !terminal.has(c.status),
    )) {
      invalidate(c);
      c.version += 1;
      c.decisionRequestedAt = null;
      resolveFor(c.id, ["OWNER_UNAVAILABLE", "DECISION_OVERDUE"]);
      if (c.status === "manager_decision")
        job("decision_request", c, r, p.ownerId, -1, now, String(c.version));
    }
    event("requisition.owner_reassigned", r.id, "", {
      oldOwner,
      ownerId: p.ownerId,
      reason: clean(p.reason),
    });
  } else if (command.type === "handoff") {
    const r = state.requisitions.find((x) => x.id === p.requisitionId);
    need(
      r?.active && canRecruit(actor, r),
      "FORBIDDEN",
      "This requisition is not available to this recruiter.",
      403,
    );
    need(
      p.reviewed === true &&
        p.sourceConfirmed === true &&
        isId(p.candidateId) &&
        clean(p.name) &&
        state.policy?.sources?.requisitions,
      "REVIEW_REQUIRED",
      "Review the candidate packet and confirm the client-designated requisition source.",
      400,
    );
    need(
      !state.cases.some(
        (c) => c.candidateId === p.candidateId && c.requisitionId === r.id,
      ),
      "ALREADY_ENROLLED",
      "This candidate already has a workflow for this requisition.",
    );
    const c = {
      id: p.caseId,
      candidateId: p.candidateId,
      requisitionId: r.id,
      name: clean(p.name, 160),
      email: clean(p.email, 254),
      timezone: clean(p.timezone, 100),
      contactAllowed: p.contactAllowed === true,
      linkVersion: 1,
      packet: clean(p.packet, 4000),
      recruiterId: actor.userId,
      status: "manager_decision",
      stageIndex: -1,
      version: 1,
      createdAt: now,
      decisionRequestedAt: null,
      planVersion: r.version,
      source: state.policy.sources.requisitions,
      verifiedBy: actor.userId,
      verifiedAt: now,
      stages: r.stages.map((s) => ({
        ...s,
        status: "pending",
        slots: [],
        feedback: [],
      })),
    };
    need(
      zoneValid(c.timezone),
      "TIMEZONE_REQUIRED",
      "Confirm the candidate’s local timezone before handoff.",
      400,
    );
    need(isId(c.id), "INVALID_CASE", "Case identity is invalid.", 400);
    state.cases.push(c);
    job("decision_request", c, r, r.managerId);
    event("handoff.approved", r.id, c.id);
  } else if (command.type === "tick") {
    need(
      actor.role === "system",
      "FORBIDDEN",
      "Only the workflow worker can run timers.",
      403,
    );
    need(state.policy, "POLICY_REQUIRED", "Client policy must be configured.");
    state.cases.forEach((c) => {
      const r = state.requisitions.find((x) => x.id === c.requisitionId);
      if (!r?.active || terminal.has(c.status)) return;
      if (
        c.status === "selection_pending" &&
        c.stages[c.stageIndex].slots.every((slot) => slot.start <= now)
      )
        exception(
          "SLOTS_EXPIRED",
          c,
          r,
          "All offered interview times have passed. The stage owner can replace the offered times.",
        );
      if (
        c.status === "scheduled" &&
        c.stages[c.stageIndex].booking.end < now &&
        !c.stages[c.stageIndex].completedAt
      )
        exception(
          "COMPLETION_UNCONFIRMED",
          c,
          r,
          "The scheduled interview time passed. An assigned participant must confirm what occurred; no completion is inferred.",
        );
      const owner = currentOwner(c, r);
      if (!member(members, owner))
        exception(
          "OWNER_UNAVAILABLE",
          c,
          r,
          "The assigned decision owner is unavailable. An administrator must reassign this task with a reason.",
        );
      if (
        ["manager_decision", "feedback_due"].includes(c.status) &&
        c.decisionRequestedAt
      ) {
        const policy = c.decisionPolicy || state.policy;
        if (
          now >=
          addWorkingDays(c.decisionRequestedAt, policy.reminderDays, policy)
        )
          job(
            "decision_reminder",
            c,
            r,
            currentOwner(c, r),
            c.stageIndex,
            now,
            c.decisionRequestedAt,
          );
        if (
          now >=
          addWorkingDays(c.decisionRequestedAt, policy.escalationDays, policy)
        ) {
          exception("DECISION_OVERDUE", c, r, "A human decision is overdue.");
          job(
            "decision_escalation",
            c,
            r,
            policy.fallbackOwnerId,
            c.stageIndex,
            now,
            c.decisionRequestedAt,
          );
        }
      }
    });
    state.jobs
      .filter((j) => j.status === "sending" && j.leaseUntil < now)
      .forEach((j) => {
        j.status = "unknown";
        exception(
          `DELIVERY_${j.id}`,
          state.cases.find((c) => c.id === j.caseId),
          state.requisitions.find((r) => r.id === j.requisitionId),
          "The sending worker stopped before a durable outcome was recorded. Reconcile before retry.",
        );
      });
    state.lastWorkerAt = now;
    event("worker.checked");
  } else if (command.type === "block_delivery") {
    need(
      actor.role === "system",
      "FORBIDDEN",
      "Only the worker can reconcile pending transport.",
      403,
    );
    const j = state.jobs.find((x) => x.id === p.jobId);
    need(j?.status === "queued", "STALE_JOB", "This job is no longer queued.");
    j.status = p.cancelled ? "cancelled" : "failed";
    j.resultCode = clean(p.reason, 100);
    j.completedAt = now;
    if (!p.cancelled)
      exception(
        `DELIVERY_${j.id}`,
        state.cases.find((c) => c.id === j.caseId),
        state.requisitions.find((r) => r.id === j.requisitionId),
        j.resultCode,
      );
    event("communication.preflight", j.requisitionId, j.caseId, {
      jobId: j.id,
      status: j.status,
      reason: j.resultCode,
    });
  } else if (
    command.type === "claim_delivery" ||
    command.type === "record_delivery"
  ) {
    need(
      actor.role === "system",
      "FORBIDDEN",
      "Only the delivery worker may record provider results.",
      403,
    );
    const jobs = p.jobIds?.map((id) => state.jobs.find((j) => j.id === id));
    need(
      jobs?.length && jobs.every(Boolean),
      "INVALID_JOB",
      "Delivery work was not found.",
    );
    jobs.forEach((j) => {
      const c = state.cases.find((x) => x.id === j.caseId),
        r = state.requisitions.find((x) => x.id === j.requisitionId);
      if (command.type === "claim_delivery") {
        need(
          j.status === "queued" && j.dueAt <= now,
          "STALE_JOB",
          "This job is no longer ready.",
        );
        j.status = "sending";
        j.leaseId = p.leaseId;
        j.leaseUntil = new Date(Date.parse(now) + 5 * 60000).toISOString();
        j.attempts += 1;
      } else {
        need(
          j.status === "sending" && j.leaseId === p.leaseId,
          "STALE_LEASE",
          "The delivery lease is no longer valid.",
        );
        need(
          ["provider_accepted", "failed", "unknown", "cancelled"].includes(
            p.status,
          ),
          "INVALID_RESULT",
          "Unknown delivery result.",
          400,
        );
        need(
          p.status !== "provider_accepted" || clean(p.providerId),
          "EVIDENCE_REQUIRED",
          "Provider acceptance requires a provider identifier.",
        );
        j.status = p.status;
        j.completedAt = now;
        j.providerId = clean(p.providerId);
        j.resultCode = clean(p.resultCode, 100);
        if (
          p.status === "provider_accepted" &&
          j.kind === "decision_request" &&
          c.stageIndex === j.stageIndex &&
          ["manager_decision", "feedback_due"].includes(c.status) &&
          !c.decisionRequestedAt
        ) {
          c.decisionRequestedAt = now;
          c.decisionPolicy = clone(state.policy);
        }
        if (p.status === "failed" && p.retryable === true && j.attempts < 3) {
          j.status = "queued";
          j.dueAt = new Date(
            Date.parse(now) + j.attempts * 5 * 60000,
          ).toISOString();
        }
        if (["failed", "unknown"].includes(j.status))
          exception(
            `DELIVERY_${j.id}`,
            c,
            r,
            p.status === "unknown"
              ? "Sending result is unknown. Verify provider evidence before any resend."
              : "Sending failed. Correct the cause or confirm manual completion.",
          );
      }
      event(`communication.${j.status}`, r.id, c.id, {
        jobId: j.id,
        kind: j.kind,
        communicationPath: c.stages[j.stageIndex]?.communicationPath || null,
        batchJobIds: jobs.map((item) => item.id),
        providerId: j.providerId || "",
      });
    });
  } else if (command.type === "provider_outcome") {
    need(
      actor.role === "system" && clean(p.providerId),
      "FORBIDDEN",
      "Provider reconciliation requires the protected worker.",
      403,
    );
    const jobs = state.jobs.filter(
      (j) =>
        j.providerId === p.providerId &&
        ["provider_accepted", "delivered"].includes(j.status),
    );
    need(
      jobs.length,
      "STALE_JOB",
      "This provider result is no longer pending.",
    );
    for (const j of jobs) {
      j.providerCheckedAt = now;
      j.providerEvent = clean(p.event, 80);
      if (["delivered", "opened", "clicked"].includes(p.event))
        j.status = "delivered";
      if (["bounced", "complained", "suppressed", "failed"].includes(p.event)) {
        j.status = "failed";
        j.resultCode = `PROVIDER_${p.event.toUpperCase()}`;
        const c = state.cases.find((c) => c.id === j.caseId),
          r = state.requisitions.find((r) => r.id === j.requisitionId);
        exception(
          `DELIVERY_${j.id}`,
          c,
          r,
          "The provider reported a delivery failure. Review recipient details and contact permission before recovery.",
        );
        if (
          j.recipientId === "candidate" &&
          ["complained", "suppressed"].includes(p.event)
        ) {
          c.contactAllowed = false;
          c.linkVersion += 1;
          c.version += 1;
        }
      }
      event("communication.provider_checked", j.requisitionId, j.caseId, {
        jobId: j.id,
        providerId: p.providerId,
        providerEvent: j.providerEvent,
        status: j.status,
      });
    }
  } else if (command.type === "recover_delivery") {
    const j = state.jobs.find((x) => x.id === p.jobId),
      r = state.requisitions.find((x) => x.id === j?.requisitionId),
      c = state.cases.find((x) => x.id === j?.caseId);
    need(
      r && canRecruit(actor, r),
      "FORBIDDEN",
      "This recovery is outside your recruiting scope.",
      403,
    );
    need(
      ["failed", "unknown"].includes(j.status) && clean(p.evidence),
      "EVIDENCE_REQUIRED",
      "Record what you verified before recovery.",
    );
    need(
      ["confirmed_sent", "confirmed_not_sent"].includes(p.outcome),
      "EVIDENCE_REQUIRED",
      "Confirm whether the original action occurred.",
    );
    j.status = p.outcome === "confirmed_sent" ? "manually_confirmed" : "queued";
    j.recoveryEvidence = clean(p.evidence);
    j.recoveredBy = actor.userId;
    j.recoveredAt = now;
    if (
      j.status === "manually_confirmed" &&
      j.kind === "decision_request" &&
      c.stageIndex === j.stageIndex &&
      !c.decisionRequestedAt
    ) {
      c.decisionRequestedAt = now;
      c.decisionPolicy = clone(state.policy);
    }
    resolveFor(c.id, [`DELIVERY_${j.id}`]);
    event("communication.reconciled", r.id, c.id, {
      jobId: j.id,
      outcome: p.outcome,
      evidence: clean(p.evidence),
    });
  } else {
    const c = state.cases.find((x) => x.id === p.caseId),
      r = state.requisitions.find((x) => x.id === c?.requisitionId);
    need(
      c && r?.active,
      "NOT_AVAILABLE",
      "This active workflow is not available.",
      404,
    );
    const candidateAction =
      actor.role === "candidate" &&
      actor.caseId === c.id &&
      actor.linkVersion === c.linkVersion;
    need(
      candidateAction || canReadCase(actor, r, c),
      "FORBIDDEN",
      "This workflow is outside your scope.",
      403,
    );
    need(
      p.expectedVersion === c.version,
      "STALE_CASE",
      "The candidate changed. Refresh before deciding.",
    );
    const s = c.stages[c.stageIndex],
      isOwner = currentOwner(c, r) === actor.userId;
    if (command.type === "decision") {
      need(
        isOwner &&
          ["manager_decision", "feedback_due", "held"].includes(c.status),
        "FORBIDDEN",
        "Only the current decision owner can decide at this point.",
        403,
      );
      need(
        ["proceed", "hold", "decline"].includes(p.decision),
        "INVALID_DECISION",
        "Choose Proceed, Hold, or Decline.",
        400,
      );
      need(
        p.decision !== "decline" || clean(p.reason),
        "REASON_REQUIRED",
        "Choose a short decline reason.",
        400,
      );
      if (c.stageIndex >= 0)
        need(
          s.completedAt,
          "INTERVIEW_INCOMPLETE",
          "Confirm that the interview occurred before recording its decision.",
        );
      need(p.decision !== "proceed" || p.schedulingMode !== "calendar" || c.stageIndex + 1 === c.stages.length,
        "CALENDAR_CONNECTION_REQUIRED", "Leadership calendar booking is not connected yet. Use manager-selected interview times, or ask your administrator to connect the leadership calendar.", 409);
      invalidate(c);
      resolveFor(c.id, ["DECISION_OVERDUE"]);
      if (p.decision === "hold") {
        need(
          c.status !== "held",
          "ALREADY_HELD",
          "This candidate is already in active review.",
        );
        c.status = "held";
        job(
          "active_review",
          c,
          r,
          "candidate",
          c.stageIndex,
          now,
          String(c.version),
        );
      } else if (p.decision === "decline") {
        c.status = "declined";
        c.finalReason = clean(p.reason);
        c.finalAt = now;
        exception("DECLINE_FOLLOW_UP_REQUIRED", c, r, "The manager declined to proceed. Recruiting must choose candidate follow-up through WelcomeFlow or the company ATS.");
        job("recruiter_decline", c, r, c.recruiterId, c.stageIndex, now, String(c.version));
      } else {
        if (s) {
          s.status = "completed";
          s.decision = "proceed";
          s.decidedAt = now;
          s.decidedBy = actor.userId;
        }
        if (c.stageIndex + 1 === c.stages.length) {
          c.status = "offer_ready";
          c.finalAt = now;
        } else {
          c.stageIndex += 1;
          c.status = "slots_needed";
          c.stages[c.stageIndex].status = "slots_needed";
          job("slots_request", c, r, currentOwner(c, r));
        }
      }
      c.lastDecision = {
        decision: p.decision,
        reason: clean(p.reason),
        comment: clean(p.comment),
        actorId: actor.userId,
        recordedAt: now,
      };
      if (s && p.decision !== "proceed") {
        s.decision = p.decision;
        s.decidedAt = now;
        s.decidedBy = actor.userId;
      }
      c.decisionRequestedAt = null;
      event("decision.recorded", r.id, c.id, {
        stageIndex: s ? c.stages.indexOf(s) : -1,
        decision: p.decision,
        reason: clean(p.reason),
        comment: clean(p.comment),
      });
    } else if (command.type === "decline_follow_up") {
      need(canRecruit(actor, r) && c.status === "declined", "FORBIDDEN", "Only recruiting can choose follow-up for a declined candidate.", 403);
      need(["welcomeflow", "ats"].includes(p.channel), "INVALID_CHANNEL", "Choose WelcomeFlow or your company ATS.", 400);
      need(!c.declineFollowUp, "FOLLOW_UP_ALREADY_CHOSEN", "Candidate follow-up has already been assigned. Check the recorded delivery before choosing again.");
      c.declineFollowUp = {channel: p.channel, actorId: actor.userId, recordedAt: now};
      if (p.channel === "welcomeflow") job("candidate_decline", c, r, "candidate", c.stageIndex);
      resolveFor(c.id, ["DECLINE_FOLLOW_UP_REQUIRED"]);
      if (p.channel === "ats") exception("ATS_DECLINE_FOLLOW_UP_REQUIRED", c, r, "Recruiting chose the company ATS. Copy the recorded decline note and send the candidate follow-up there; no external ATS write was made.");
      event("decline.follow_up_assigned", r.id, c.id, {channel: p.channel});
    } else if (command.type === "offer_slots") {
      need(
        isOwner && ["slots_needed", "selection_pending"].includes(c.status),
        "FORBIDDEN",
        "Only the stage owner can provide interview slots.",
        403,
      );
      need(
        Array.isArray(p.slots) && p.slots.length > 0 && p.slots.length <= 10,
        "INVALID_SLOTS",
        "Provide one or more interview slots.",
        400,
      );
      need(
        clean(p.instructions) && clean(p.location),
        "INTERVIEW_DETAILS_REQUIRED",
        "Provide joining details and preparation information before offering interview times.",
        400,
      );
      s.location = clean(p.location, 1000);
      s.instructions = clean(p.instructions, 2000);
      s.slots = p.slots.map((v, i) => {
        need(
          validTime(v.start) &&
            validTime(v.end) &&
            Date.parse(v.start) > Date.parse(now) &&
            Date.parse(v.end) > Date.parse(v.start),
          "INVALID_SLOTS",
          "Choose future interview slots with an end after the start.",
          400,
        );
        return {
          id: `${s.id}-${c.version}-${i}`,
          start: new Date(v.start).toISOString(),
          end: new Date(v.end).toISOString(),
        };
      });
      c.status = "selection_pending";
      s.status = "selection_pending";
      invalidate(c);
      job(
        "slot_selection",
        c,
        r,
        "candidate",
        c.stageIndex,
        now,
        String(c.version),
      );
      resolveFor(c.id, ["SLOTS_EXPIRED"]);
      s.availabilityVerified = {
        source: state.policy.sources.calendarAvailability,
        verifiedBy: actor.userId,
        verifiedAt: now,
      };
      event("interview.slots_offered", r.id, c.id, {
        stageIndex: c.stageIndex,
        verification: s.availabilityVerified,
      });
    } else if (command.type === "book") {
      need(
        candidateAction &&
          actor.purpose === "booking" &&
          actor.stageIndex === c.stageIndex &&
          c.status === "selection_pending",
        "FORBIDDEN",
        "This scheduling link is no longer available.",
        403,
      );
      const slot = s.slots.find((v) => v.id === p.slotId);
      need(
        slot && slot.start > now,
        "SLOT_EXPIRED",
        "That interview time is no longer available.",
      );
      const participants = new Set([s.ownerId, ...s.interviewerIds]);
      need(
        !state.cases.some(
          (other) =>
            other.id !== c.id &&
            !["declined", "withdrawn"].includes(other.status) &&
            other.stages.some(
              (stage) =>
                stage.booking &&
                !stage.completedAt &&
                [stage.ownerId, ...stage.interviewerIds].some((id) =>
                  participants.has(id),
                ) &&
                stage.booking.start < slot.end &&
                stage.booking.end > slot.start,
            ),
        ),
        "SLOT_CONFLICT",
        "That slot is reserved. Choose another offered time.",
      );
      s.booking = slot;
      s.status = "scheduled";
      c.status = "scheduled";
      invalidate(c);
      const leadHours = (Date.parse(slot.start) - Date.parse(now)) / HOUR;
      s.communicationPath =
        leadHours > 48
          ? "standard_48_24"
          : leadHours >= 24
            ? "short_notice_24_48"
            : "short_notice_under_24";
      s.bookedAt = now;
      s.communicationPolicyVersion = state.policy.version;
      job("confirmation", c, r, "candidate");
      job(
        "manager_interview",
        c,
        r,
        s.ownerId,
        c.stageIndex,
        new Date(
          Math.max(Date.parse(now), Date.parse(slot.start) - 24 * HOUR),
        ).toISOString(),
      );
      if (leadHours >= 24) {
        job(
          "preparation",
          c,
          r,
          "candidate",
          c.stageIndex,
          leadHours > 48
            ? new Date(Date.parse(slot.start) - 48 * HOUR).toISOString()
            : now,
        );
        if (leadHours > 24)
          job(
            "interview_reminder",
            c,
            r,
            "candidate",
            c.stageIndex,
            new Date(Date.parse(slot.start) - 24 * HOUR).toISOString(),
          );
      }
      event("interview.communication_path_selected", r.id, c.id, {
        stageIndex: c.stageIndex,
        path: s.communicationPath,
        leadHours,
        policyVersion: state.policy.version,
        transactionalConfirmation: true,
        preparationInConfirmation: leadHours < 24,
      });
      event("interview.booked", r.id, c.id, {
        stageIndex: c.stageIndex,
        start: slot.start,
        end: slot.end,
      });
    } else if (command.type === "complete_interview") {
      need(
        s &&
          [s.ownerId, ...s.interviewerIds].includes(actor.userId) &&
          c.status === "scheduled",
        "FORBIDDEN",
        "Only an assigned participant can confirm this interview.",
        403,
      );
      need(
        validTime(p.occurredAt) &&
          p.occurredAt <= now &&
          p.occurredAt >= s.booking.start &&
          p.confirmed === true,
        "COMPLETION_REQUIRED",
        "Confirm the actual interview completion time.",
        400,
      );
      resolveFor(c.id, ["COMPLETION_UNCONFIRMED"]);
      s.completedAt = p.occurredAt;
      s.completedBy = actor.userId;
      s.status = "feedback_due";
      c.status = "feedback_due";
      c.decisionRequestedAt = null;
      invalidate(c);
      job("decision_request", c, r, s.ownerId, c.stageIndex);
      job(
        "experience",
        c,
        r,
        "candidate",
        c.stageIndex,
        new Date(
          Date.parse(p.occurredAt) + state.policy.checkInHours * HOUR,
        ).toISOString(),
      );
      event("interview.completed", r.id, c.id, {
        stageIndex: c.stageIndex,
        occurredAt: p.occurredAt,
      });
    } else if (command.type === "feedback") {
      need(
        s?.completedAt &&
          [s.ownerId, ...s.interviewerIds].includes(actor.userId) &&
          !terminal.has(c.status),
        "FORBIDDEN",
        "Feedback is available to assigned interview participants.",
        403,
      );
      need(
        clean(p.feedback),
        "FEEDBACK_REQUIRED",
        "Enter supporting feedback.",
        400,
      );
      s.feedback.push({
        actorId: actor.userId,
        text: clean(p.feedback, 2000),
        recordedAt: now,
      });
      event("feedback.recorded", r.id, c.id, { stageIndex: c.stageIndex });
    } else if (command.type === "experience") {
      const stage = c.stages[actor.stageIndex];
      need(
        candidateAction &&
          actor.purpose === "experience" &&
          stage?.completedAt &&
          !stage.experience,
        "FORBIDDEN",
        "This experience check-in is no longer available.",
        403,
      );
      need(
        ["yes", "unsure", "no"].includes(p.interested) &&
          ["positive", "neutral", "negative"].includes(p.experience) &&
          typeof p.followUp === "boolean",
        "INVALID_RESPONSE",
        "Choose your interest, experience, and follow-up preference.",
        400,
      );
      stage.experience = {
        interested: p.interested,
        rating: p.experience,
        followUp: p.followUp,
        questions: clean(p.questions, 1000),
        feedback: clean(p.feedback, 2000),
        recordedAt: now,
      };
      if (
        p.interested !== "yes" ||
        p.experience === "negative" ||
        p.followUp ||
        clean(p.questions)
      )
        exception(
          `CANDIDATE_FOLLOW_UP_${actor.stageIndex}`,
          c,
          r,
          "The candidate requested attention after their interview. Review their response; do not infer withdrawal.",
        );
      event("candidate.experience_recorded", r.id, c.id, {
        stageIndex: actor.stageIndex,
        interested: p.interested,
        experience: p.experience,
        followUp: p.followUp,
      });
    } else if (command.type === "withdraw") {
      need(
        canRecruit(actor, r) && p.confirmed === true && clean(p.reason),
        "CONFIRMATION_REQUIRED",
        "Confirm the candidate’s withdrawal and record a short reason.",
        403,
      );
      need(
        !terminal.has(c.status),
        "ALREADY_CLOSED",
        "This case already has a final outcome.",
      );
      c.status = "withdrawn";
      c.finalAt = now;
      c.finalReason = clean(p.reason);
      c.finalComment = clean(p.comment);
      invalidate(c);
      state.jobs
        .filter((j) => j.caseId === c.id && j.status === "queued")
        .forEach((j) => {
          j.status = "cancelled";
        });
      event("candidate.withdrawn", r.id, c.id, {
        reason: c.finalReason,
        comment: c.finalComment,
      });
    } else if (command.type === "replace_candidate_link") {
      need(
        canRecruit(actor, r) && clean(p.reason),
        "FORBIDDEN",
        "An authorized recruiter must explain the replacement.",
        403,
      );
      const index = p.stageIndex,
        stage = c.stages[index];
      need(
        stage &&
          ((p.purpose === "booking" &&
            index === c.stageIndex &&
            c.status === "selection_pending") ||
            (p.purpose === "experience" &&
              stage.completedAt &&
              !stage.experience)),
        "LINK_INACTIVE",
        "This candidate action is no longer pending.",
      );
      const kind = p.purpose === "booking" ? "slot_selection" : "experience";
      need(
        !state.jobs.some(
          (j) =>
            j.caseId === c.id &&
            j.stageIndex === index &&
            j.kind === kind &&
            ["sending", "unknown"].includes(j.status),
        ),
        "RECONCILIATION_REQUIRED",
        "Reconcile any uncertain send before replacing this request.",
      );
      state.jobs
        .filter(
          (j) =>
            j.caseId === c.id &&
            j.stageIndex === index &&
            j.kind === kind &&
            j.status === "queued",
        )
        .forEach((j) => {
          j.status = "cancelled";
        });
      c.linkVersion += 1;
      job(kind, c, r, "candidate", index, now, `replacement-${c.version}`);
      event("candidate.link_replaced", r.id, c.id, {
        stageIndex: index,
        purpose: p.purpose,
        reason: clean(p.reason),
      });
    } else if (command.type === "update_contact") {
      need(
        canRecruit(actor, r) &&
          clean(p.reason) &&
          zoneValid(p.timezone) &&
          typeof p.contactAllowed === "boolean",
        "REVIEW_REQUIRED",
        "Confirm corrected contact details, permission, timezone, and reason.",
        403,
      );
      c.linkVersion += 1;
      c.email = clean(p.email, 254);
      c.timezone = p.timezone;
      c.contactAllowed = p.contactAllowed;
      event("candidate.contact_confirmed", r.id, c.id, {
        reason: clean(p.reason),
        contactAllowed: c.contactAllowed,
        timezone: c.timezone,
      });
    } else if (command.type === "reassign_owner") {
      need(
        actor.role === "admin" &&
          member(members, p.ownerId) &&
          clean(p.reason) &&
          !terminal.has(c.status),
        "FORBIDDEN",
        "An administrator, active replacement owner, and reason are required.",
        403,
      );
      need(
        c.stageIndex >= 0,
        "REQUISITION_OWNER_REQUIRED",
        "Requisition ownership changes require a client administrator to update the requisition assignment.",
      );
      need(
        ["feedback_due", "held", "slots_needed"].includes(c.status),
        "AVAILABILITY_REVIEW_REQUIRED",
        "Resolve the existing scheduled interview or offered times with the assigned owner before changing availability authority.",
      );
      const oldOwner = s.ownerId;
      s.ownerId = p.ownerId;
      state.jobs
        .filter(
          (j) =>
            j.caseId === c.id &&
            j.recipientId === oldOwner &&
            j.status === "queued",
        )
        .forEach((j) => {
          j.status = "cancelled";
        });
      resolveFor(c.id, ["OWNER_UNAVAILABLE", "DECISION_OVERDUE"]);
      c.decisionRequestedAt = null;
      if (["feedback_due", "manager_decision"].includes(c.status))
        job(
          "decision_request",
          c,
          r,
          p.ownerId,
          c.stageIndex,
          now,
          String(c.version),
        );
      if (c.status === "slots_needed")
        job(
          "slots_request",
          c,
          r,
          p.ownerId,
          c.stageIndex,
          now,
          String(c.version),
        );
      event("stage.owner_reassigned", r.id, c.id, {
        oldOwner,
        ownerId: p.ownerId,
        reason: clean(p.reason),
      });
    } else if (command.type === "resolve_exception") {
      need(
        canRecruit(actor, r) && clean(p.resolution),
        "FORBIDDEN",
        "An authorized recruiter must record the resolution.",
        403,
      );
      const e = state.exceptions.find(
        (x) => x.id === p.exceptionId && x.caseId === c.id,
      );
      need(
        e &&
          !e.code.startsWith("DELIVERY_") &&
          ![
            "DECISION_OVERDUE",
            "OWNER_UNAVAILABLE",
            "SLOTS_EXPIRED",
            "COMPLETION_UNCONFIRMED",
          ].includes(e.code),
        "RECOVERY_REQUIRED",
        "Resolve the underlying action through its recovery or decision control.",
      );
      e.status = "resolved";
      e.resolvedAt = now;
      e.resolvedBy = actor.userId;
      e.resolution = clean(p.resolution);
      event("exception.resolved", r.id, c.id, {
        exceptionId: e.id,
        resolution: e.resolution,
      });
    } else
      fail("UNKNOWN_COMMAND", "This workflow action is not supported.", 400);
    c.version += 1;
    c.updatedAt = now;
  }
  state.revision = input.revision + 1;
  return { state, events };
}
module.exports = {
  emptyState,
  applyCommand,
  stateView,
  canRecruit,
  canManage,
  canReadCase,
  currentOwner,
  withinWindow,
  zoneValid,
  addWorkingDays,
  localParts,
  member,
  clean,
  fail,
  need,
  isId,
  deliveryFinal,
};
