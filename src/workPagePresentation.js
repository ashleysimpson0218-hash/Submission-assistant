export const PRIMARY_WORK_FILTERS = Object.freeze([
  "Mine",
  "Due Today",
  "Scheduled",
  "Waiting on Others",
  "At Risk",
  "All Categories",
]);

function validDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function localDateKey(value) {
  const date = validDate(value);
  if (!date) return "";
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function isAtRisk(task = {}) {
  return Boolean(task.isOverdue)
    || ["High", "Critical"].includes(task.riskLevel)
    || task.filters?.includes("Candidate Rescue")
    || task.filters?.includes("Stuck");
}

function isScheduled(task = {}, now = new Date()) {
  if (task.sourceType === "calendar" && !task.isOverdue) return true;
  const due = validDate(task.dueAt);
  return Boolean(due && due >= now && !task.isOverdue);
}

export function filterWorkPageTasks(tasks = [], filter = "Mine", now = new Date()) {
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const current = validDate(now) || new Date();
  const today = localDateKey(current);
  if (filter === "Mine") return safeTasks.filter((task) => task.ownerType === "Recruiter");
  if (filter === "Due Today") return safeTasks.filter((task) => localDateKey(task.dueAt) === today);
  if (filter === "Scheduled") return safeTasks.filter((task) => isScheduled(task, current));
  if (filter === "Waiting on Others") return safeTasks.filter((task) => task.filters?.includes("Waiting on Others"));
  if (filter === "At Risk") return safeTasks.filter(isAtRisk);
  return safeTasks;
}

export function buildWorkPagePresentation({ tasks = [], actionCenterCount = 0, reportReadiness = null, now = new Date() } = {}) {
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const candidateIds = new Set(safeTasks.filter((task) => task.sourceType === "candidate" && task.candidateId).map((task) => task.candidateId));
  const handoffs = safeTasks.filter((task) => task.ownerType && !["Recruiter", "System or Requisition Issue"].includes(task.ownerType));
  const count = (filter) => filterWorkPageTasks(safeTasks, filter, now).length;
  return {
    counts: {
      Mine: count("Mine"),
      "Due Today": count("Due Today"),
      Scheduled: count("Scheduled"),
      "Waiting on Others": count("Waiting on Others"),
      "At Risk": count("At Risk"),
      "All Categories": Number(actionCenterCount) || 0,
    },
    activeCandidateWork: candidateIds.size,
    slaExceptions: safeTasks.filter((task) => task.isOverdue).length,
    handoffs: handoffs.length,
    stalledHandoffs: handoffs.filter((task) => task.isOverdue || ["High", "Critical"].includes(task.riskLevel)).length,
    reportReadiness,
  };
}
