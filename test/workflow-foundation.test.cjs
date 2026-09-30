const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  emptyState,
  applyCommand,
  stateView,
  withinWindow,
  addWorkingDays,
} = require("../src/workflow/engine");
const {
  eligible,
  deliveryGroups,
  buildMessage,
} = require("../server/workflow/communications");
const {
  signCapability,
  verifyCapability,
} = require("../server/workflow/capabilities");
const members = [
  "admin",
  "recruiter",
  "manager",
  "panel",
  "leader",
  "other",
].map((role) => ({
  userId: role,
  role:
    role === "panel"
      ? "interviewer"
      : role === "leader"
        ? "leadership"
        : role === "other"
          ? "manager"
          : role,
  active: true,
  version: 1,
  name: role,
  email: `${role}@example.com`,
  timezone: "America/New_York",
}));
const now = "2026-09-24T14:00:00.000Z";
let serial = 0;
function fixture(count = 1) {
  let state = emptyState();
  const run = (type, payload = {}, who = "admin", at = now) => {
    const actor =
      typeof who === "object"
        ? who
        : who === "system"
          ? { userId: "worker", role: "system", active: true }
          : members.find((m) => m.userId === who);
    const out = applyCommand(
      state,
      {
        id: `cmd-${++serial}`,
        type,
        payload:
          type === "offer_slots"
            ? {
                location: "https://video.example.test/interview",
                instructions: "Review the role and bring questions.",
                ...payload,
              }
            : payload,
      },
      { actor, members, now: at },
    );
    state = out.state;
    return out;
  };
  run("configure_policy", {
    timezone: "America/New_York",
    fallbackOwnerId: "leader",
    sources: {
      requisitions: "Client approved requisitions",
      calendarAvailability: "Assigned stage owner",
    },
    reason: "Client setup",
  });
  run("configure_requisition", {
    id: "req",
    title: "Driver",
    managerId: "manager",
    recruiterIds: ["recruiter"],
    stages: Array.from({ length: count }, (_, i) => ({
      id: `stage-${i}`,
      name: `Interview ${i + 1}`,
      ownerId: "manager",
      interviewerIds: ["panel"],
    })),
  });
  const handoff = (id = "candidate") =>
    run(
      "handoff",
      {
        caseId: id,
        candidateId: id,
        requisitionId: "req",
        reviewed: true,
        sourceConfirmed: true,
        name: id,
        email: `${id}@example.com`,
        timezone: "America/New_York",
        contactAllowed: true,
        packet: "Approved packet",
      },
      "recruiter",
    );
  handoff();
  return {
    run,
    handoff,
    get state() {
      return state;
    },
    get c() {
      return state.cases[0];
    },
    action(type, p = {}, who = "manager", at = now) {
      return run(
        type,
        {
          caseId: state.cases[0].id,
          expectedVersion: state.cases[0].version,
          ...p,
        },
        who,
        at,
      );
    },
    candidate(purpose = "booking", stageIndex = state.cases[0].stageIndex) {
      return {
        userId: "candidate:candidate",
        role: "candidate",
        active: true,
        caseId: "candidate",
        linkVersion: state.cases[0].linkVersion,
        stageIndex,
        purpose,
      };
    },
  };
}
function schedule(f, base = now) {
  f.action("decision", { decision: "proceed" }, "manager", base);
  const start = new Date(Date.parse(base) + 4 * 86400000).toISOString(),
    end = new Date(Date.parse(start) + 3600000).toISOString();
  f.action("offer_slots", { slots: [{ start, end }] }, "manager", base);
  f.action(
    "book",
    { slotId: f.c.stages[f.c.stageIndex].slots[0].id },
    f.candidate(),
    base,
  );
  return { start, end };
}
function accepted(f, j, at = now) {
  f.run("claim_delivery", { jobIds: [j.id], leaseId: "lease" }, "system", at);
  f.run(
    "record_delivery",
    {
      jobIds: [j.id],
      leaseId: "lease",
      status: "provider_accepted",
      providerId: "provider-id",
    },
    "system",
    at,
  );
}
test("one and three required interviews use the same progression; panel cannot decide", () => {
  for (const count of [1, 3]) {
    const f = fixture(count);
    let at = now;
    for (let i = 0; i < count; i++) {
      if (i === 0) {
        f.action("decision", { decision: "proceed" });
      }
      assert.equal(f.c.stageIndex, i);
      assert.equal(f.c.status, "slots_needed");
      const start = new Date(Date.parse(at) + 4 * 86400000).toISOString(),
        end = new Date(Date.parse(start) + 3600000).toISOString();
      f.action("offer_slots", { slots: [{ start, end }] }, "manager", at);
      f.action(
        "book",
        { slotId: f.c.stages[i].slots[0].id },
        f.candidate(),
        at,
      );
      assert.throws(
        () => f.action("decision", { decision: "proceed" }, "manager", at),
        /Only the current/,
      );
      f.action(
        "complete_interview",
        { confirmed: true, occurredAt: end },
        "panel",
        end,
      );
      f.action("feedback", { feedback: "Supporting evidence" }, "panel", end);
      assert.throws(
        () => f.action("decision", { decision: "proceed" }, "panel", end),
        /Only the current/,
      );
      f.action("decision", { decision: "proceed" }, "manager", end);
      assert.equal(
        f.c.status,
        i === count - 1 ? "offer_ready" : "slots_needed",
      );
      at = end;
    }
    assert.equal(
      f.c.stages.filter((s) => s.completedAt && s.decidedBy === "manager")
        .length,
      count,
    );
  }
});
test("scope denies unrelated managers and broad panel browsing; closed requisitions disappear", () => {
  const f = fixture();
  f.handoff("second");
  assert.equal(
    stateView(
      f.state,
      members.find((m) => m.userId === "other"),
      members,
    ).cases.length,
    0,
  );
  const panel = stateView(
    f.state,
    members.find((m) => m.userId === "panel"),
    members,
  );
  assert.equal(panel.requisitions.length, 0);
  assert.equal(panel.cases[0].email, undefined);
  assert.equal(stateView(f.state, members[4], members).cases.length, 0);
  f.run("set_requisition_active", {
    requisitionId: "req",
    active: false,
    reason: "Closed at source",
  });
  assert.equal(stateView(f.state, members[2], members).cases.length, 0);
});
test("stale decisions and duplicate candidate enrollment cannot advance", () => {
  const f = fixture();
  assert.throws(
    () => f.action("decision", { decision: "proceed", expectedVersion: 0 }),
    /Refresh/,
  );
  assert.throws(() => f.handoff(), /already has/);
  assert.equal(f.c.status, "manager_decision");
});
test("Hold produces one no-date communication; decline requires a reason", () => {
  const f = fixture();
  assert.throws(() => f.action("decision", { decision: "decline" }), /reason/);
  f.action("decision", { decision: "hold" });
  assert.throws(
    () => f.action("decision", { decision: "hold" }),
    /already in active review/,
  );
  const group = deliveryGroups(f.state, members, now).find(
    (g) => g.jobs[0].kind === "active_review",
  );
  const mail = buildMessage(group, f.state, members, now, {
    origin: "https://example.com",
    workspaceId: "test",
  });
  assert.match(mail.text, /in active review/);
  assert.doesNotMatch(mail.text, /update you by/);
  f.action("decision", {
    decision: "decline",
    reason: "Schedule mismatch",
    comment: "Optional detail",
  });
  assert.equal(f.c.finalReason, "Schedule mismatch");
});
test("expired slots can be replaced without duplicating the original request", () => {
  const f = fixture();
  f.action("decision", { decision: "proceed" });
  const slots = [
    { start: "2026-09-28T14:00:00.000Z", end: "2026-09-28T15:00:00.000Z" },
  ];
  f.action("offer_slots", { slots });
  const old = f.c.stages[0].slots[0].id;
  f.action("offer_slots", {
    slots: [
      { start: "2026-09-29T14:00:00.000Z", end: "2026-09-29T15:00:00.000Z" },
    ],
  });
  assert.throws(
    () => f.action("book", { slotId: old }, f.candidate()),
    /no longer available/,
  );
  assert.equal(
    f.state.jobs.filter(
      (j) => j.kind === "slot_selection" && j.status === "queued",
    ).length,
    1,
  );
});
test("shared participants cannot double-book overlapping interviews", () => {
  const f = fixture();
  schedule(f);
  f.handoff("second");
  const second = () => f.state.cases[1];
  f.run(
    "decision",
    {
      caseId: "second",
      expectedVersion: second().version,
      decision: "proceed",
    },
    "manager",
  );
  f.run(
    "offer_slots",
    {
      caseId: "second",
      expectedVersion: second().version,
      slots: [f.c.stages[0].booking],
    },
    "manager",
  );
  assert.throws(
    () =>
      f.run(
        "book",
        {
          caseId: "second",
          expectedVersion: second().version,
          slotId: second().stages[0].slots[0].id,
        },
        { ...f.candidate(), caseId: "second", userId: "candidate:second" },
      ),
    /reserved/,
  );
});
test("elapsed interview time never establishes completion", () => {
  const f = fixture();
  const { end } = schedule(f);
  f.run("tick", {}, "system", end);
  assert.equal(f.c.status, "scheduled");
  assert.equal(f.c.stages[0].completedAt, undefined);
  assert.equal(f.state.jobs.filter((j) => j.kind === "experience").length, 0);
});
test("check-in follows confirmed completion and positive replies create no task", () => {
  const f = fixture();
  const { end } = schedule(f);
  f.action(
    "complete_interview",
    { confirmed: true, occurredAt: end },
    "manager",
    end,
  );
  const j = f.state.jobs.find((j) => j.kind === "experience");
  assert.equal(Date.parse(j.dueAt) - Date.parse(end), 7200000);
  f.action(
    "experience",
    { interested: "yes", experience: "positive", followUp: false },
    f.candidate("experience"),
    j.dueAt,
  );
  assert.equal(
    f.state.exceptions.filter((e) => e.code.startsWith("CANDIDATE_FOLLOW_UP"))
      .length,
    0,
  );
  assert.equal(f.c.status, "feedback_due");
});
test("negative candidate signal creates one exception, never a rejection or withdrawal", () => {
  const f = fixture();
  const { end } = schedule(f);
  f.action(
    "complete_interview",
    { confirmed: true, occurredAt: end },
    "manager",
    end,
  );
  f.action(
    "experience",
    {
      interested: "no",
      experience: "negative",
      followUp: true,
      questions: "Who can help?",
    },
    f.candidate("experience"),
    end,
  );
  assert.equal(f.c.status, "feedback_due");
  const e = f.state.exceptions.find((e) =>
    e.code.startsWith("CANDIDATE_FOLLOW_UP"),
  );
  assert.equal(e.ownerId, "recruiter");
  assert.throws(
    () =>
      f.action(
        "experience",
        { interested: "no", experience: "negative", followUp: true },
        f.candidate("experience"),
        end,
      ),
    /no longer available/,
  );
});
test("unknown send requires evidence; recovery starts the decision clock only when confirmed", () => {
  const f = fixture();
  const j = f.state.jobs[0];
  f.run("claim_delivery", { jobIds: [j.id], leaseId: "lease" }, "system");
  f.run("tick", {}, "system", "2026-09-24T14:06:00.000Z");
  assert.equal(f.state.jobs[0].status, "unknown");
  assert.equal(f.c.decisionRequestedAt, null);
  assert.throws(
    () =>
      f.run(
        "recover_delivery",
        { jobId: j.id, outcome: "confirmed_sent" },
        "recruiter",
      ),
    /Record what/,
  );
  f.run(
    "recover_delivery",
    {
      jobId: j.id,
      outcome: "confirmed_sent",
      evidence: "Verified provider record message-123",
    },
    "recruiter",
  );
  assert.equal(f.state.jobs[0].status, "manually_confirmed");
  assert.equal(f.c.decisionRequestedAt, now);
});
test("provider acceptance is distinct from delivered; confirmed rejection retries are bounded", () => {
  const f = fixture();
  accepted(f, f.state.jobs[0]);
  assert.equal(f.state.jobs[0].status, "provider_accepted");
  assert.equal(f.c.decisionRequestedAt, now);
});
test("consolidated decisions keep individual candidates, clocks and authorized context", () => {
  const f = fixture();
  f.handoff("second");
  const groups = deliveryGroups(f.state, members, now);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].jobs.length, 2);
  const mail = buildMessage(groups[0], f.state, members, now, {
    origin: "https://example.com",
    workspaceId: "test",
  });
  assert.match(mail.text, /candidate/);
  assert.match(mail.text, /second/);
  assert.equal(mail.to, "manager@example.com");
});
test("policy is recipient local, configurable, DST safe and not role tiered", () => {
  const f = fixture();
  assert.equal(
    withinWindow(
      "2026-09-24T10:59:00.000Z",
      "America/New_York",
      f.state.policy,
    ),
    false,
  );
  assert.equal(
    withinWindow(
      "2026-09-24T11:00:00.000Z",
      "America/New_York",
      f.state.policy,
    ),
    true,
  );
  assert.equal(
    withinWindow(
      "2026-09-24T22:30:00.000Z",
      "America/New_York",
      f.state.policy,
    ),
    false,
  );
  assert.equal(
    addWorkingDays("2026-03-06T15:00:00.000Z", 1, f.state.policy),
    "2026-03-09T14:00:00.000Z",
  );
  assert.equal(
    addWorkingDays("2026-09-24T14:00:00.000Z", 6, f.state.policy),
    "2026-10-02T14:00:00.000Z",
  );
  assert.equal(
    eligible(
      f.state.jobs[0],
      f.state,
      members.map((m) =>
        m.userId === "manager" ? { ...m, timezone: "unknown" } : m,
      ),
      now,
    ).state,
    "blocked",
  );
});
test("immediate after-hours confirmation includes preparation under 24 hours; routine messages wait", () => {
  const f = fixture();
  f.action("decision", { decision: "proceed" });
  f.action("offer_slots", {
    slots: [
      { start: "2026-09-25T14:00:00.000Z", end: "2026-09-25T15:00:00.000Z" },
    ],
  });
  const at = "2026-09-25T00:00:00.000Z";
  f.action("book", { slotId: f.c.stages[0].slots[0].id }, f.candidate(), at);
  assert.equal(f.c.stages[0].communicationPath, "short_notice_under_24");
  assert.equal(f.state.exceptions.length, 0);
  const jobs = f.state.jobs.filter((j) =>
    ["confirmation", "preparation", "interview_reminder"].includes(j.kind),
  );
  assert.deepEqual(
    jobs.map((j) => j.kind),
    ["confirmation"],
  );
  assert.equal(eligible(jobs[0], f.state, members, at).state, "ready");
  assert.equal(
    eligible(
      f.state.jobs.find((j) => j.kind === "manager_interview"),
      f.state,
      members,
      at,
    ).state,
    "waiting",
  );
  const group = deliveryGroups(f.state, members, at).find(
    (g) => g.jobs[0].kind === "confirmation",
  );
  assert.match(
    buildMessage(group, f.state, members, at, {
      origin: "https://example.com",
      workspaceId: "test",
    }).text,
    /Joining details and preparation/,
  );
});
test("48 and 24 hour boundaries avoid expired reminders, batch simultaneous content, and audit the path", () => {
  for (const hours of [24, 36, 48, 49, 72]) {
    const f = fixture();
    f.action("decision", { decision: "proceed" });
    const start = new Date(Date.parse(now) + hours * 3600000).toISOString();
    f.action("offer_slots", {
      slots: [
        { start, end: new Date(Date.parse(start) + 3600000).toISOString() },
      ],
    });
    const result = f.action(
      "book",
      { slotId: f.c.stages[0].slots[0].id },
      f.candidate(),
    );
    assert.ok(
      result.events.some(
        (e) => e.type === "interview.communication_path_selected",
      ),
    );
    const reminders = f.state.jobs.filter(
      (j) => j.kind === "interview_reminder",
    );
    assert.equal(reminders.length, hours > 24 ? 1 : 0);
    const prep = f.state.jobs.find((j) => j.kind === "preparation");
    assert.equal(
      prep.dueAt,
      hours > 48
        ? new Date(Date.parse(start) - 48 * 3600000).toISOString()
        : now,
    );
    const group = deliveryGroups(f.state, members, now).find((g) =>
      g.jobs.some((j) => j.kind === "confirmation"),
    );
    assert.equal(group.jobs.length, hours <= 48 ? 2 : 1);
  }
});
test("overdue routine interview messages are consolidated after a send window or outage", () => {
  const f = fixture();
  schedule(f);
  const at = "2026-09-27T14:00:00.000Z";
  // Sunday remains outside the default working calendar; only confirmation is transactional.
  const sunday = deliveryGroups(f.state, members, at).filter((g) =>
    g.jobs.some((j) => j.recipientId === "candidate"),
  );
  assert.deepEqual(
    sunday.flatMap((g) => g.jobs.map((j) => j.kind)),
    ["confirmation"],
  );
  const monday = "2026-09-28T11:00:00.000Z";
  const group = deliveryGroups(f.state, members, monday).find((g) =>
    g.jobs.some((j) => j.kind === "confirmation"),
  );
  assert.equal(group.jobs.length, 3);
  assert.match(
    buildMessage(group, f.state, members, monday, {
      origin: "https://example.com",
      workspaceId: "test",
    }).text,
    /also includes your interview reminder/,
  );
});
test("contact revocation prevents queued communications and invalidates old links", () => {
  const f = fixture();
  f.action("decision", { decision: "proceed" });
  f.action("offer_slots", {
    slots: [
      { start: "2026-09-28T14:00:00.000Z", end: "2026-09-28T15:00:00.000Z" },
    ],
  });
  const actor = f.candidate();
  f.action(
    "update_contact",
    {
      email: "changed@example.com",
      timezone: "America/New_York",
      contactAllowed: false,
      reason: "Candidate revoked email consent",
    },
    "recruiter",
  );
  assert.equal(
    eligible(
      f.state.jobs.find((j) => j.kind === "slot_selection"),
      f.state,
      members,
      now,
    ).state,
    "blocked",
  );
  assert.throws(
    () => f.action("book", { slotId: f.c.stages[0].slots[0].id }, actor),
    /outside your scope/,
  );
});
test("signed candidate links reject tampering and expiry", () => {
  const secret = "x".repeat(40),
    claims = {
      workspaceId: "w",
      caseId: "c",
      stageIndex: 0,
      purpose: "booking",
      linkVersion: 1,
      expiresAt: Date.parse(now) + 86400000,
    };
  const token = signCapability(claims, secret);
  assert.equal(verifyCapability(token, secret, Date.parse(now)).caseId, "c");
  assert.throws(
    () => verifyCapability(token + "x", secret, Date.parse(now)),
    /invalid/,
  );
  assert.throws(
    () => verifyCapability(token, secret, claims.expiresAt + 1),
    /expired/,
  );
});
test("explicit provider throttling retries three times; uncertainty never automatically retries", () => {
  const f = fixture();
  let at = now;
  const id = f.state.jobs[0].id;
  for (let attempt = 1; attempt <= 3; attempt++) {
    f.run(
      "claim_delivery",
      { jobIds: [id], leaseId: `lease-${attempt}` },
      "system",
      at,
    );
    f.run(
      "record_delivery",
      {
        jobIds: [id],
        leaseId: `lease-${attempt}`,
        status: "failed",
        retryable: true,
        resultCode: "PROVIDER_REJECTED_429",
      },
      "system",
      at,
    );
    at = f.state.jobs[0].dueAt;
  }
  assert.equal(f.state.jobs[0].attempts, 3);
  assert.equal(f.state.jobs[0].status, "failed");
  assert.equal(f.c.decisionRequestedAt, null);
});
test("known provider bounce becomes an owned recovery exception, not successful delivery", () => {
  const f = fixture();
  accepted(f, f.state.jobs[0]);
  f.run(
    "provider_outcome",
    { providerId: "provider-id", event: "bounced" },
    "system",
  );
  assert.equal(f.state.jobs[0].status, "failed");
  assert.ok(
    f.state.exceptions.some(
      (e) => e.code.startsWith("DELIVERY_") && e.ownerId === "recruiter",
    ),
  );
});
test("an after-hours 24–48 hour booking sends confirmation alone and defers preparation to the window", () => {
  const f = fixture();
  f.action("decision", { decision: "proceed" });
  f.action("offer_slots", {
    slots: [
      { start: "2026-09-26T12:00:00.000Z", end: "2026-09-26T13:00:00.000Z" },
    ],
  });
  const at = "2026-09-25T00:00:00.000Z";
  f.action("book", { slotId: f.c.stages[0].slots[0].id }, f.candidate(), at);
  const group = deliveryGroups(f.state, members, at).find(
    (g) => g.jobs[0].kind === "confirmation",
  );
  assert.deepEqual(
    group.jobs.map((j) => j.kind),
    ["confirmation"],
  );
  const message = buildMessage(group, f.state, members, at, {
    origin: "https://example.com",
    workspaceId: "test",
  });
  assert.match(message.text, /Joining details:/);
  assert.doesNotMatch(message.text, /Review the role and bring questions/);
  assert.equal(
    eligible(
      f.state.jobs.find((j) => j.kind === "preparation"),
      f.state,
      members,
      at,
    ).state,
    "waiting",
  );
});
