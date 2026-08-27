import {
  buildCandidateWorkspaceTasks,
  buildRecruiterWorkspaceModel,
  buildWorkspaceReportReadiness,
  buildWrapUpSummary,
  candidateRiskForWorkspace,
  compareWorkspaceTasks,
  ownerForCandidate,
  scoreWorkspaceTask,
} from "./recruiterWorkspaceSelectors";

const NOW = new Date("2026-07-22T12:00:00.000Z");

describe("recruiter workspace selectors", () => {
  test("uses stable task identity as the final deterministic ordering rule", () => {
    const tasks = [
      { id: "candidate:z", priorityScore: 40, priority: 3, daysWaiting: 2 },
      { id: "candidate:a", priorityScore: 40, priority: 3, daysWaiting: 2 },
      { id: "candidate:m", priorityScore: 40, priority: 3, daysWaiting: 2 },
    ];
    const expected = ["candidate:a", "candidate:m", "candidate:z"];
    expect([...tasks].sort(compareWorkspaceTasks).map((task) => task.id)).toEqual(expected);
    expect([...tasks].reverse().sort(compareWorkspaceTasks).map((task) => task.id)).toEqual(expected);
  });

  test("uses locale-independent code-point ordering for mixed stable identities", () => {
    const tasks = [
      { id: "candidate:a", priorityScore: 40, priority: 3, daysWaiting: 2 },
      { id: "candidate:_", priorityScore: 40, priority: 3, daysWaiting: 2 },
      { id: "candidate:%2F", priorityScore: 40, priority: 3, daysWaiting: 2 },
      { id: "candidate:A", priorityScore: 40, priority: 3, daysWaiting: 2 },
      { id: "candidate:-", priorityScore: 40, priority: 3, daysWaiting: 2 },
    ];
    const expected = ["candidate:%2F", "candidate:-", "candidate:A", "candidate:_", "candidate:a"];
    expect([...tasks].sort(compareWorkspaceTasks).map((task) => task.id)).toEqual(expected);
    expect([...tasks].reverse().sort(compareWorkspaceTasks).map((task) => task.id)).toEqual(expected);
  });

  test("assigns delayed manager work to the hiring manager", () => {
    expect(ownerForCandidate({ status: "Submitted", nextAction: "Await decision maker review" })).toEqual({ type: "Hiring Manager", label: "Hiring Manager" });
  });

  test("explains candidate risk using current activity", () => {
    const risk = candidateRiskForWorkspace({ status: "Submitted", submissionDate: "2026-07-15", lastActionAt: "2026-07-15T12:00:00.000Z" }, NOW);
    expect(["High", "Critical"]).toContain(risk.level);
    expect(risk.reason).toMatch(/days without recorded activity/i);
  });

  test("builds an explainable queue and keeps different owners separate", () => {
    const tasks = buildCandidateWorkspaceTasks([
      { id: "candidate-1", candidate: "Synthetic Candidate One", status: "Submitted", nextAction: "Await decision maker review", submissionDate: "2026-07-21", candidateNotes: "Synthetic fixture" },
      { id: "candidate-2", candidate: "Synthetic Candidate Two", status: "Screen Complete", nextAction: "Complete submission", updatedAt: "2026-07-22", candidateNotes: "Synthetic fixture" },
    ], { now: NOW });
    expect(tasks).toHaveLength(2);
    expect(tasks.find((task) => task.sourceId === "candidate-1").ownerType).toBe("Hiring Manager");
    expect(tasks.find((task) => task.sourceId === "candidate-1").filters).toContain("Waiting on Others");
    expect(tasks.find((task) => task.sourceId === "candidate-2").ownerType).toBe("Recruiter");
    expect(tasks.every((task) => task.reason && task.recommendedAction)).toBe(true);
  });

  test("allows one task to appear in every applicable filter without duplicating the task", () => {
    const [task] = buildCandidateWorkspaceTasks([{ id: "candidate-risk", candidate: "Synthetic Risk Candidate", status: "Submitted", nextAction: "Await decision maker review", submissionDate: "2026-07-15", lastActionAt: "2026-07-15T12:00:00.000Z" }], { now: NOW });
    expect(task.filters).toEqual(expect.arrayContaining(["Candidate Rescue", "Waiting on Others"]));
  });

  test("identifies recruiting coverage without hard-coded dashboard counts", () => {
    const model = buildRecruiterWorkspaceModel({
      now: NOW,
      tracker: [],
      requisitions: [{ id: "req-1", status: "Active", positionTitle: "Synthetic LPN", siteName: "Synthetic Facility", openings: 4, openDate: "2026-07-01" }],
    });
    expect(model.tasks.filter((task) => task.category === "Recruiting Needed")).toHaveLength(1);
    expect(model.plan.focusMinutes).toBe(60);
    expect(model.focusTask.reason).toMatch(/4 openings/i);
  });

  test("uses meaningful empty states instead of a false perfect health score", () => {
    const model = buildRecruiterWorkspaceModel({ tracker: [], requisitions: [], now: NOW });
    expect(model.snapshot.reportReady).toBeNull();
    expect(model.health.candidateFollowUp.status).toBe("Not enough data");
    expect(model.health.offerProcess.status).toBe("Not enough data");
  });

  test("honors current owner overrides, snooze, and reviewed risk decisions", () => {
    const overridden = { id: "candidate-owner", candidate: "Synthetic Owner", status: "Submitted", nextAction: "Await decision maker review", ownerType: "Regional Leader", currentOwner: "Regional Leader", riskOverride: "Not at risk", riskOverrideAt: "2026-07-22T11:00:00.000Z", riskOverrideNote: "Interest confirmed", lastActionAt: "2026-07-22T10:00:00.000Z" };
    const [task] = buildCandidateWorkspaceTasks([overridden], { now: NOW });
    expect(task.ownerType).toBe("Regional Leader");
    expect(task.riskLevel).toBe("Low");
    expect(task.riskReason).toBe("Interest confirmed");
    const snoozed = buildCandidateWorkspaceTasks([{ ...overridden, snoozedUntil: "2026-07-23T12:00:00.000Z" }], { now: NOW });
    expect(snoozed).toHaveLength(0);
  });

  test("uses configurable thresholds and explains weighted priority", () => {
    const item = { id: "candidate-config", status: "Submitted", submissionDate: "2026-07-20T12:00:00.000Z", lastActionAt: "2026-07-20T12:00:00.000Z" };
    expect(candidateRiskForWorkspace(item, NOW, { workspaceRiskInactivityDays: 3 }).level).toBe("Low");
    expect(candidateRiskForWorkspace(item, NOW, { workspaceRiskInactivityDays: 1 }).level).toBe("High");
    const scored = scoreWorkspaceTask({ riskLevel: "High", isOverdue: true, daysWaiting: 4, ownerType: "Recruiter" });
    expect(scored.score).toBeGreaterThan(60);
    expect(scored.reasons).toEqual(expect.arrayContaining(["high candidate or requisition risk", "recruiter owns the next action"]));
  });

  test("builds an actionable weekly report readiness audit from shared records", () => {
    const report = buildWorkspaceReportReadiness({
      tracker: [{ id: "candidate-report", candidate: "Synthetic Candidate", status: "Offer Accepted", site: "Synthetic Center", nextAction: "", candidateNotes: "", requisitionId: "req-1" }],
      requisitions: [{ id: "req-1", reqNumber: "100", positionTitle: "Synthetic LPN", siteName: "Synthetic Center", facilityId: "facility-1" }],
      sites: [{ id: "facility-1", siteName: "Synthetic Center", status: "Active" }],
      tasks: [{ sourceType: "candidate", sourceId: "candidate-report", riskLevel: "High", riskReason: "Synthetic documented risk" }],
    });
    expect(report.percent).toBeLessThan(100);
    expect(report.missingNotes).toBe(1);
    expect(report.missingNextActions).toBe(1);
    expect(report.missingStartDates).toBe(1);
    expect(report.facilityIssues).toBe(0);
    expect(report.issues.some((issue) => issue.fixLocation === "Candidate Profile")).toBe(true);
  });

  test("summarizes end-of-day completion, tomorrow work, and recruiting time", () => {
    const summary = buildWrapUpSummary({
      now: NOW,
      tracker: [{ id: "candidate-tomorrow", nextActionDueDate: "2026-07-23T15:00:00.000Z" }],
      history: [{ id: "history-1", type: "Recruiting Focus Session Completed", timestamp: "2026-07-22T10:00:00.000Z", meta: { minutes: 30 } }],
      tasks: [{ riskLevel: "High", isOverdue: false, filters: ["Candidate Rescue"], ownerType: "Recruiter", dueAt: "" }],
      reportReadiness: { percent: 80 },
    });
    expect(summary.actionsCompleted).toBe(1);
    expect(summary.followUpsTomorrow).toBe(1);
    expect(summary.recruitingMinutesCompleted).toBe(30);
    expect(summary.candidateRisksRemaining).toBe(1);
    expect(summary.reportReadiness).toBe(80);
  });

  test("connects passed calendar events to the Work Queue and weekly readiness", () => {
    const calendarEvents = [{
      id: "calendar-past",
      eventType: "Facility Interview",
      title: "Synthetic Interview",
      candidateId: "candidate-calendar",
      candidateName: "Synthetic Candidate",
      startDateTime: "2026-07-22T09:00:00.000Z",
      endDateTime: "2026-07-22T10:00:00.000Z",
      outcomeStatus: "Pending",
      eventStatus: "Scheduled",
      recruiterId: "current-recruiter",
    }];
    const model = buildRecruiterWorkspaceModel({ tracker: [], requisitions: [], calendarEvents, now: NOW });
    expect(model.tasks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "calendar-outcome:calendar-past", sourceType: "calendar", recommendedAction: "Add the event outcome" }),
    ]));
    expect(model.reportReadiness.calendarEventsMissingOutcomes).toBe(1);
    expect(model.wrapUp.eventsMissingOutcomes).toBe(1);
  });
});
