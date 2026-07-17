export const TEST_SUPABASE_PROJECT_REF = "bjverobaoujhfaylyrzi";
export const PRODUCTION_SUPABASE_PROJECT_REF = "qfpgednixvveelgwfylv";
export const SAFE_REQUISITION_ERROR = "WelcomeFlow could not safely identify one requisition to update.";

export const COMMUNICATION_DETAIL_FIELDS = [
  "employmentType",
  "benefitsEligible",
  "fte",
  "weeklyHours",
  "shiftPreference",
  "workSchedule",
  "contractDuration",
];

export const COMMUNICATION_DETAIL_LABELS = {
  employmentType: "Employment Type",
  benefitsEligible: "Benefits Eligible",
  fte: "FTE",
  weeklyHours: "Weekly Hours",
  shiftPreference: "Shift",
  workSchedule: "Schedule",
  contractDuration: "Contract Duration",
};

export function assertTestRuntime(runtime = {}) {
  const environment = String(runtime.environment || "").trim().toLowerCase();
  const projectRef = String(runtime.projectRef || "").trim().toLowerCase();
  if (environment !== "test") return { ok: false, error: "Communication Details requires REACT_APP_ENVIRONMENT=test.", environment, projectRef };
  if (projectRef === PRODUCTION_SUPABASE_PROJECT_REF) return { ok: false, error: "Test mode refuses the production Supabase project.", environment, projectRef };
  if (projectRef !== TEST_SUPABASE_PROJECT_REF) return { ok: false, error: "Communication Details requires the WelcomeFlow Test Supabase project.", environment, projectRef };
  return { ok: true, environment, projectRef };
}

export function normalizeBenefitsEligible(value) {
  if (value === true || value === "true" || value === "Yes") return true;
  if (value === false || value === "false" || value === "No") return false;
  return null;
}

export function normalizeWeeklyHours(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeOptionalText(value) {
  const clean = String(value ?? "").trim();
  return clean || null;
}

export function communicationDetailsFromRequisition(req = {}) {
  return {
    employmentType: req.employmentType || "",
    benefitsEligible: normalizeBenefitsEligible(req.benefitsEligible),
    fte: req.fte ?? "",
    weeklyHours: normalizeWeeklyHours(req.weeklyHours),
    shiftPreference: req.shiftPreference || "",
    workSchedule: req.workSchedule || "",
    contractDuration: normalizeOptionalText(req.contractDuration),
  };
}

function comparable(value) {
  return value === undefined || value === "" ? null : value;
}

export function communicationDetailChanges(original = {}, draft = {}) {
  const before = communicationDetailsFromRequisition(original);
  const after = communicationDetailsFromRequisition(draft);
  return COMMUNICATION_DETAIL_FIELDS.flatMap((field) => comparable(before[field]) === comparable(after[field]) ? [] : [{
    field,
    label: COMMUNICATION_DETAIL_LABELS[field],
    previousValue: before[field],
    newValue: after[field],
  }]);
}

export function displayCommunicationValue(field, value) {
  if (field === "benefitsEligible") return value === true ? "Yes" : value === false ? "No" : "Unknown";
  if (value === null || value === undefined || value === "") return "Blank";
  return String(value);
}

export function communicationSummary(req = {}) {
  const benefits = normalizeBenefitsEligible(req.benefitsEligible);
  const parts = [req.employmentType || "Employment Type Unknown"];
  parts.push(benefits === true ? "Benefits Eligible" : benefits === false ? "No Benefits" : "Benefits Unknown");
  const duration = normalizeOptionalText(req.contractDuration);
  if (String(req.employmentType || "").toLowerCase() === "contract" && duration) parts.push(duration);
  const hours = normalizeWeeklyHours(req.weeklyHours);
  if (hours !== null) parts.push(`${hours} Hours`);
  else if (req.workSchedule) parts.push(req.workSchedule);
  if (req.shiftPreference) parts.push(req.shiftPreference);
  return parts.join(" • ");
}

export function updateExistingRequisitionCommunicationDetails(requisitions = [], selectedId, draft = {}, { now = () => new Date().toISOString() } = {}) {
  const matches = requisitions.map((req, index) => ({ req, index })).filter(({ req }) => req?.id === selectedId);
  if (!selectedId || matches.length !== 1) throw new Error(SAFE_REQUISITION_ERROR);
  const { req: original, index } = matches[0];
  const normalizedDraft = { ...original, ...draft,
    benefitsEligible: normalizeBenefitsEligible(draft.benefitsEligible),
    weeklyHours: normalizeWeeklyHours(draft.weeklyHours),
    contractDuration: normalizeOptionalText(draft.contractDuration),
  };
  const changes = communicationDetailChanges(original, normalizedDraft);
  if (!changes.length) return { requisitions, requisition: original, changes: [], auditEntry: null };
  const timestamp = now();
  const patch = Object.fromEntries(COMMUNICATION_DETAIL_FIELDS.map((field) => [field, normalizedDraft[field]]));
  const auditEntry = {
    id: `req-config-${timestamp}`,
    timestamp,
    label: "Requisition communication configuration updated",
    source: "Communication Details",
    environment: "test",
    requisitionId: original.id,
    reqNumber: original.reqNumber || "",
    uniqueIdNumber: original.uniqueIdNumber || "",
    facility: original.siteName || "",
    changedFields: changes.map((change) => change.field),
    previousValues: Object.fromEntries(changes.map((change) => [change.field, change.previousValue])),
    newValues: Object.fromEntries(changes.map((change) => [change.field, change.newValue])),
  };
  const updated = { ...original, ...patch, updatedAt: timestamp, audit: [...(Array.isArray(original.audit) ? original.audit : []), auditEntry] };
  const next = requisitions.slice();
  next[index] = updated;
  return { requisitions: next, requisition: updated, changes, auditEntry };
}
