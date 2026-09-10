import { buildWorkPagePresentation, filterWorkPageTasks, PRIMARY_WORK_FILTERS } from "./workPagePresentation";

const NOW = new Date("2026-08-27T12:00:00-04:00");
const tasks = [
  { id: "mine", sourceType: "candidate", candidateId: "candidate-1", ownerType: "Recruiter", dueAt: "2026-08-27T15:00:00-04:00", filters: ["Do Now"], riskLevel: "Low", isOverdue: false },
  { id: "scheduled", sourceType: "calendar", candidateId: "candidate-1", ownerType: "Recruiter", dueAt: "2026-08-28T09:00:00-04:00", filters: ["Do Now"], riskLevel: "Medium", isOverdue: false },
  { id: "handoff", sourceType: "candidate", candidateId: "candidate-2", ownerType: "Hiring Manager", dueAt: "2026-08-26T09:00:00-04:00", filters: ["Waiting on Others", "Stuck"], riskLevel: "High", isOverdue: true },
];

test("exposes the approved primary Work-page filters in their intended order", () => {
  expect(PRIMARY_WORK_FILTERS).toEqual(["Mine", "Due Today", "Scheduled", "Waiting on Others", "At Risk", "All Categories"]);
});

test("organizes existing canonical tasks without changing or mutating them", () => {
  const source = JSON.parse(JSON.stringify(tasks));
  expect(filterWorkPageTasks(tasks, "Mine", NOW).map((task) => task.id)).toEqual(["mine", "scheduled"]);
  expect(filterWorkPageTasks(tasks, "Due Today", NOW).map((task) => task.id)).toEqual(["mine"]);
  expect(filterWorkPageTasks(tasks, "Scheduled", NOW).map((task) => task.id)).toEqual(["mine", "scheduled"]);
  expect(filterWorkPageTasks(tasks, "Waiting on Others", NOW).map((task) => task.id)).toEqual(["handoff"]);
  expect(filterWorkPageTasks(tasks, "At Risk", NOW).map((task) => task.id)).toEqual(["handoff"]);
  expect(tasks).toEqual(source);
});

test("builds compact module summaries from the existing task and Action Center models", () => {
  expect(buildWorkPagePresentation({ tasks, actionCenterCount: 9, reportReadiness: 84, now: NOW })).toEqual({
    counts: { Mine: 2, "Due Today": 1, Scheduled: 2, "Waiting on Others": 1, "At Risk": 1, "All Categories": 9 },
    activeCandidateWork: 2,
    slaExceptions: 1,
    handoffs: 1,
    stalledHandoffs: 1,
    reportReadiness: 84,
  });
});
