import React, { useEffect, useMemo, useState } from "react";

const NL = String.fromCharCode(10);

const STORAGE_KEY = "welcomeflow-settings-v2";
const TRACKER_KEY = "welcomeflow-tracker-v2";
const HISTORY_KEY = "welcomeflow-history-v2";
const NOTES_KEY = "welcomeflow-notes-v2";

const BRAND = {
  appName: "WelcomeFlow",
  product: "Recruiting Assistant",
  tagline: "Submission control, follow-ups, and recruiter-ready emails in one premium workflow.",
  footer: "© Central 54 Holdings LLC",
};

const THEME = {
  pageBg: "#f4f7fb",
  panel: "#ffffff",
  panelAlt: "#f8fafc",
  border: "#dbe3ee",
  borderSoft: "#e8eef7",
  text: "#101828",
  muted: "#667085",
  muted2: "#8a95a8",
  primary: "#172554",
  primary2: "#2563eb",
  green: "#047857",
  amber: "#b45309",
  red: "#b42318",
  blueBg: "#dbeafe",
  greenBg: "#d1fae5",
  amberBg: "#fef3c7",
  redBg: "#fee4e2",
  slateBg: "#eef2f7",
};

const ROLE_TYPES = ["Healthcare", "Other"];
const WORK_TYPES = ["On-site", "Remote", "Hybrid"];
const SHIFT_OPTIONS = ["Day", "Night", "Evening", "Day or Night", "Evening or Night", "Any Shift"];
const START_OPTIONS = ["Immediate", "2-4 weeks", "4-6 weeks", "3 months", "6 months"];
const OWNER_OPTIONS = ["Recruiter", "Hiring Manager", "Candidate"];
const NEXT_ACTION_OPTIONS = [
  "Follow up with facility",
  "Follow up with candidate",
  "Awaiting manager review",
  "Schedule interview",
  "Send interview reminder",
  "Request feedback",
  "Update ATS",
  "Archive candidate",
  "No action needed",
];
const STATUS_OPTIONS = ["Submitted", "Awaiting Review", "Interview Requested", "Interview Scheduled", "Interview Completed", "Offer", "Placed", "Rejected", "Archived"];
const OUTCOME_OPTIONS = ["Placed", "Rejected", "Withdrawn", "No response", "Future consideration", "Duplicate", "Other"];
const FTE_OPTIONS = [
  { label: "40 hrs/week (1.0)", value: "1.0" },
  { label: "36 hrs/week (0.9)", value: "0.9" },
  { label: "32 hrs/week (0.8)", value: "0.8" },
  { label: "24 hrs/week (0.6)", value: "0.6" },
  { label: "20 hrs/week (0.5)", value: "0.5" },
  { label: "16 hrs/week (0.4)", value: "0.4" },
  { label: "PRN", value: "PRN" },
];

const SOURCE_OPTIONS = ["Indeed", "LinkedIn", "Referral", "Direct Apply", "Internal", "Rehire", "Job Fair", "Agency", "Other"];
const REQUISITION_STATUS_OPTIONS = ["Active", "Pause", "Filled", "Closed"];

const DEFAULT_SETTINGS = {
  general: {
    workspaceName: "Central 54 Recruiting",
    companyName: "",
    hiringManagerEmail: "",
    recruiterName: "",
    recruiterEmail: "",
    recruiterPhone: "",
    signOffName: "",
    signOffLine: "",
  },
  options: {
    roleTypes: ROLE_TYPES,
    workTypes: WORK_TYPES,
    employmentTypes: ["FT", "PT", "PRN", "Contract", "FT or PT"],
    shiftOptions: SHIFT_OPTIONS,
    startAvailabilityOptions: START_OPTIONS,
    educationLevels: ["High School", "Associate's", "Bachelor's", "Bachelor of Science in Nursing", "Master's", "Doctorate", "Certification / Trade"],
    licenseStatusOptions: ["Active/Clear", "Active/Encumbered", "Inactive", "Pending", "Not Verified", "Not Required"],
    cprStatusOptions: ["Active", "Inactive", "Pending", "Not Required"],
    workExpectationOptions: {
      ot: ["None", "Occasional", "Required"],
      weekend: ["None", "Rotating", "Required"],
      onCall: ["None", "Occasional", "Required"],
    },
    candidateSourceOptions: SOURCE_OPTIONS,
    requisitionStatusOptions: REQUISITION_STATUS_OPTIONS,
  },
  sites: [
    { id: "site-1", siteName: "Demo Facility", siteType: "24-hour", location: "Douglasville, GA", hiringManagerName: "", hiringManagerEmail: "", adminContactName: "", adminContactEmail: "", status: "Active", notes: "" },
  ],
  roles: [
    { id: "role-1", positionTitle: "Registered Nurse", roleCategory: "Healthcare", requiresLicense: true, requiresCpr: true, requiresFte: true, requiresShift: true, requiresWorkExpectations: true, status: "Active" },
    { id: "role-2", positionTitle: "Administrative Assistant", roleCategory: "Other", requiresLicense: false, requiresCpr: false, requiresFte: false, requiresShift: false, requiresWorkExpectations: true, status: "Active" },
  ],
  requisitions: [
    { id: "req-1", reqNumber: "REQ-1001", positionTitle: "Registered Nurse", siteName: "Demo Facility", employmentType: "FT", shiftPreference: "Day", fte: "1.0", status: "Active", notes: "Demo active requisition" },
  ],
  compensationStructure: {
    enabled: true,
    rules: [
      { id: "comp-1", positionTitle: "Registered Nurse", scopeType: "Site Type", scopeValue: "24-hour", compensationType: "Hourly", basisType: "Years-based", experienceTier: "6-10", baseAmount: "$42.25/hr", shiftDifferentialNight: "$2.00/hr", shiftDifferentialWeekend: "$1.50/hr", shiftDifferentialEvening: "$1.00/hr", customNotes: "" },
    ],
  },
  templates: {
    hiringManager: { useCustom: false, subject: "", body: "" },
    candidateConfirmation: { useCustom: false, subject: "", body: "" },
    candidate48HourFollowUp: { useCustom: false, subject: "Checking in on {position} submission", body: "Hello {candidate_name},\n\nI wanted to share a quick update that your profile remains under review for the {position} role with {facility}. I will continue monitoring this and will send updates as soon as they are available.\n\nThank you,\n{recruiter_name}" },
    interviewReminder: { useCustom: false, subject: "Interview Reminder: {position} with {facility}", body: "Hello {candidate_name},\n\nThis is a reminder for your upcoming interview for the {position} role with {facility}.\n\nInterview Availability/Timing: {interview_availability}\n\nPlease let me know if anything changes.\n\nThank you,\n{recruiter_name}" },
    interviewCompletedFollowUp: { useCustom: false, subject: "Post-interview follow-up: {candidate_name}", body: "Hello {candidate_name},\n\nThank you for completing the interview for the {position} role. I will follow up once feedback is available from the hiring team.\n\nThank you,\n{recruiter_name}" },
    managerFeedbackRequest: { useCustom: false, subject: "Feedback Requested: {candidate_name} | {position}", body: "Hello {facility},\n\nPlease send feedback for {candidate_name} for the {position} role when available. This will help us keep the candidate updated and move the process forward.\n\nThank you,\n{recruiter_name}" },
    weeklyReport: { useCustom: false, subject: "Weekly Submission Summary", body: "" },
    atsUpdate: { useCustom: false, subject: "ATS Update: {candidate_name}", body: "Candidate: {candidate_name}\nRole: {position}\nFacility: {facility}\nStatus: {status}\nNext Action: {next_action}\nNotes: {candidate_notes}" },
    introLine: "Please review the candidate details below.",
    closingLine: "The candidate is aware of the role expectations and is prepared to move forward.",
    followUpLine: "Please review and advise next steps within 24-48 hours.",
    includeSubmissionDate: true,
    includeEducation: true,
    includeCredentials: true,
    candidateEmailIntro: "Thank you for taking the time to speak with me today.",
    candidateEmailNextStep1: "Your information is currently being reviewed by the hiring team.",
    candidateEmailNextStep2: "If selected, the facility may reach out directly regarding interview coordination.",
    candidateEmailNextStep3: "I will continue to monitor your submission and share updates as they become available.",
    candidateEmailTiming: "You can expect an update within 24-48 hours.",
    candidateEmailSupportLine: "If anything changes on your end, please feel free to reach out directly.",
  },
};

const DEFAULT_FORM = {
  fullName: "",
  phoneNumber: "",
  emailAddress: "",
  location: "",
  selectedRequisitionId: "",
  reqNumber: "",
  candidateSource: "",
  position: "",
  roleCategory: "",
  siteName: "",
  employmentType: "FT",
  shiftPreference: "",
  workType: "",
  fte: "",
  yearsExperience: "",
  experienceNotes: "",
  educationLevel: "",
  fieldOfStudy: "",
  compensationRequested: "",
  compensationType: "Hourly",
  startAvailability: "",
  startNotes: "",
  interviewAvailability: "",
  interviewDate: "",
  licenseStatus: "",
  cprStatus: "",
  licensedYear: "",
  workSchedule: "",
  otRequirement: "",
  weekendRequirement: "",
  onCallRequirement: "",
  workArea: "",
  scheduleConfirmed: false,
  otConfirmed: false,
  weekendConfirmed: false,
  onCallConfirmed: false,
  candidateNotes: "",
};

const DEMO_FORM = {
  ...DEFAULT_FORM,
  fullName: "Ashley Martin",
  phoneNumber: "770-318-8742",
  emailAddress: "Ashleysimpson0218@gmail.com",
  location: "Douglasville, GA",
  selectedRequisitionId: "req-1",
  reqNumber: "REQ-1001",
  candidateSource: "Indeed",
  position: "Registered Nurse",
  roleCategory: "Healthcare",
  siteName: "Demo Facility",
  employmentType: "FT",
  shiftPreference: "Day",
  workType: "On-site",
  fte: "1.0",
  yearsExperience: "10",
  experienceNotes: "Corrections 3 yrs | Med-Surg 3 yrs | Strong communicator",
  educationLevel: "Bachelor of Science in Nursing",
  startAvailability: "2-4 weeks",
  startNotes: "Needs to give two-week notice",
  interviewAvailability: "Mon-Fri after 4 PM",
  licenseStatus: "Active/Clear",
  cprStatus: "Active",
  licensedYear: "2019",
  workSchedule: "36 hrs/week, nights",
  otRequirement: "Occasional",
  weekendRequirement: "Rotating",
  onCallRequirement: "None",
  workArea: "Corrections",
  scheduleConfirmed: true,
  otConfirmed: true,
  weekendConfirmed: true,
  onCallConfirmed: true,
  candidateNotes: "Responsive by text. Open to nights and long-term placement.",
};

function makeId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function displayDate(value) {
  if (!value) return "N/A";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-US");
}

function loadStoredValue(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveStoredValue(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function downloadTextFile(name, content, type = "text/plain") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const clean = String(value ?? "");
  return /[",\n]/.test(clean) ? `"${clean.replace(/"/g, '""')}"` : clean;
}

function toCsv(rows, columns) {
  return [columns.map(csvEscape).join(","), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(","))].join(NL);
}

function parseCsv(text) {
  const lines = String(text || "").split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];
  const parseLine = (line) => {
    const cells = [];
    let current = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"' && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === "," && !quoted) {
        cells.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    cells.push(current.trim());
    return cells;
  };
  const headers = parseLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = parseLine(line);
    return headers.reduce((record, header, index) => ({ ...record, [header]: values[index] ?? "" }), {});
  });
}

function readFileText(file, onText) {
  const reader = new FileReader();
  reader.onload = () => onText(String(reader.result || ""));
  reader.readAsText(file);
}

function mergeDefaults(defaults, stored) {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return defaults;
  const next = { ...defaults, ...stored };
  Object.keys(defaults).forEach((key) => {
    if (defaults[key] && typeof defaults[key] === "object" && !Array.isArray(defaults[key])) {
      next[key] = mergeDefaults(defaults[key], stored[key]);
    }
  });
  return next;
}

function labelFromKey(key) {
  const special = {
    signOffName: "Sign-Off Name",
    signOffLine: "Sign-Off Line",
    requiresCpr: "Requires CPR",
    requiresFte: "Requires FTE",
    shiftDifferentialNight: "Night Differential",
    shiftDifferentialWeekend: "Weekend Differential",
    shiftDifferentialEvening: "Evening Differential",
  };
  if (special[key]) return special[key];
  return String(key)
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}

function useWindowWidth() {
  const [width, setWidth] = useState(() => window.innerWidth || 1200);
  useEffect(() => {
    function onResize() {
      setWidth(window.innerWidth || 1200);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return width;
}

function safeCopy(text) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text || "").then(() => {
      window.dispatchEvent(new CustomEvent("welcomeflow-copy", { detail: "Copied to clipboard" }));
    }).catch(() => {});
  }
}

function managerEmailFor(settings, item = {}) {
  return item.managerEmail || settings.general.hiringManagerEmail || settings.general.recruiterEmail || "";
}

function isThisWeek(dateIso) {
  if (!dateIso) return false;
  const date = new Date(`${dateIso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  start.setDate(today.getDate() - today.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return date >= start && date < end;
}

function migrateTrackerRecords(records, settings) {
  return (records || []).map((item) => {
    const snapshot = item.formSnapshot || {};
    const candidate = item.candidate || snapshot.fullName || "Unnamed Candidate";
    const position = item.position || snapshot.position || "N/A";
    return {
      ...item,
      id: item.id || makeId("sub"),
      candidate,
      position,
      site: item.site || snapshot.siteName || "N/A",
      candidateEmail: item.candidateEmail || snapshot.emailAddress || "",
      reqNumber: item.reqNumber || snapshot.reqNumber || "",
      candidateSource: item.candidateSource || snapshot.candidateSource || "",
      requisitionId: item.requisitionId || snapshot.selectedRequisitionId || "",
      managerEmail: managerEmailFor(settings, item),
      submissionDate: item.submissionDate || todayIso(),
      status: item.status || "Submitted",
      owner: item.owner || "Recruiter",
      nextAction: item.nextAction || (isClosedStatus(item.status) ? "No action needed" : "Awaiting manager review"),
      interviewDate: item.interviewDate || snapshot.interviewDate || "",
      formSnapshot: { ...DEFAULT_FORM, ...snapshot },
      output: item.output || null,
      archived: Boolean(item.archived || item.status === "Archived"),
      archiveOutcome: item.archiveOutcome || "",
      archiveReason: item.archiveReason || "",
      futureReviewStatus: item.futureReviewStatus || "",
      archiveNotes: item.archiveNotes || "",
      audit: item.audit?.length ? item.audit : [{ id: makeId("audit"), timestamp: new Date().toISOString(), label: "Record migrated", detail: `${candidate} | ${position}` }],
    };
  });
}

function mailtoLink(to, subject, body) {
  const params = new URLSearchParams({ subject, body });
  return `mailto:${encodeURIComponent(to || "")}?${params.toString()}`;
}

function daysBetween(startIso, end = new Date()) {
  if (!startIso) return 0;
  const start = new Date(`${startIso}T00:00:00`);
  if (Number.isNaN(start.getTime())) return 0;
  return Math.max(0, Math.floor((end - start) / 86400000));
}

function tierFromYears(value) {
  const years = Number(value || 0);
  if (years <= 2) return "0-2";
  if (years <= 5) return "3-5";
  if (years <= 10) return "6-10";
  if (years <= 15) return "11-15";
  return "16+";
}

function fteLabel(value) {
  const match = FTE_OPTIONS.find((item) => item.value === value);
  return match ? match.label : value || "N/A";
}

function buildEducation(form) {
  if (form.educationLevel && form.fieldOfStudy) return `${form.educationLevel} in ${form.fieldOfStudy}`;
  return form.educationLevel || form.fieldOfStudy || "N/A";
}

function riskFor(item) {
  if (item.status === "Archived" || item.status === "Placed" || item.status === "Rejected") return "Low";
  if (item.nextAction === "Request feedback" || daysBetween(item.submissionDate) >= 5) return "High";
  if (daysBetween(item.submissionDate) >= 2 || item.nextAction.includes("Follow up")) return "Medium";
  return "Low";
}

function isClosedStatus(status) {
  return ["Archived", "Placed", "Rejected"].includes(status);
}

function tokenMap(form, settings, extra = {}) {
  return {
    candidate_name: form.fullName || "Candidate",
    position: form.position || "position",
    facility: form.siteName || settings.general.companyName || "the facility",
    req_number: form.reqNumber || "N/A",
    candidate_source: form.candidateSource || "N/A",
    experience: form.yearsExperience || "N/A",
    start_date: form.startAvailability || "N/A",
    interview_availability: form.interviewAvailability || "N/A",
    recruiter_name: settings.general.signOffName || settings.general.recruiterName || "",
    recruiter_email: settings.general.recruiterEmail || "",
    candidate_notes: form.candidateNotes || "",
    status: extra.status || "Submitted",
    next_action: extra.nextAction || "Awaiting manager review",
    submission_date: displayDate(extra.submissionDate || todayIso()),
    total_submitted: extra.total ?? extra.totalSubmitted ?? "",
    active_count: extra.active ?? "",
    awaiting_review: extra.awaiting ?? "",
    interview_count: extra.interview ?? "",
    placed_count: extra.placed ?? "",
    rejected_count: extra.rejected ?? "",
    high_risk_count: extra.highRisk ?? "",
    final_compensation: extra.final_compensation || extra.finalComp || "",
    ...extra,
  };
}

function applyTokens(template, values) {
  return String(template || "").replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => values[key] ?? "");
}

function badgeColors(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized.includes("high") || normalized.includes("rejected")) return { bg: THEME.redBg, color: THEME.red };
  if (normalized.includes("medium") || normalized.includes("awaiting") || normalized.includes("feedback")) return { bg: THEME.amberBg, color: THEME.amber };
  if (normalized.includes("placed") || normalized.includes("low") || normalized.includes("completed")) return { bg: THEME.greenBg, color: THEME.green };
  if (normalized.includes("interview")) return { bg: THEME.blueBg, color: THEME.primary2 };
  return { bg: THEME.slateBg, color: THEME.text };
}

function Button({ children, onClick, primary, subtle, danger, style, type = "button", disabled }) {
  const bg = danger ? "#fff1f3" : primary ? `linear-gradient(135deg, ${THEME.primary} 0%, ${THEME.primary2} 100%)` : subtle ? THEME.panelAlt : "#ffffff";
  const color = danger ? THEME.red : primary ? "#ffffff" : THEME.text;
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{ padding: "10px 13px", borderRadius: 8, border: `1px solid ${danger ? "#fecdca" : primary ? THEME.primary : THEME.border}`, background: bg, color, fontWeight: 700, fontSize: 12, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1, fontFamily: "Inter, Arial, sans-serif", ...style }}>
      {children}
    </button>
  );
}

function FileButton({ children, accept, onText, style }) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "10px 13px", borderRadius: 8, border: `1px solid ${THEME.border}`, background: THEME.panelAlt, color: THEME.text, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "Inter, Arial, sans-serif", ...style }}>
      {children}
      <input type="file" accept={accept} style={{ display: "none" }} onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) readFileText(file, onText);
        event.target.value = "";
      }} />
    </label>
  );
}

function Field({ label, children }) {
  return <label style={{ display: "block" }}><div style={{ marginBottom: 6, fontSize: 11, fontWeight: 800, color: THEME.muted, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>{children}</label>;
}

function TextInput({ value, onChange, placeholder, type = "text", readOnly }) {
  return <input value={value || ""} onChange={onChange} placeholder={placeholder || ""} type={type} readOnly={readOnly} style={{ width: "100%", padding: "11px 12px", borderRadius: 8, border: `1px solid ${THEME.border}`, boxSizing: "border-box", background: readOnly ? THEME.panelAlt : "#ffffff", color: THEME.text, outline: "none", fontSize: 13, fontFamily: "Inter, Arial, sans-serif" }} />;
}

function SelectInput({ value, onChange, options, placeholder }) {
  return (
    <select value={value || ""} onChange={onChange} style={{ width: "100%", padding: "11px 12px", borderRadius: 8, border: `1px solid ${THEME.border}`, boxSizing: "border-box", background: "#ffffff", color: THEME.text, outline: "none", fontSize: 13, fontFamily: "Inter, Arial, sans-serif" }}>
      <option value="">{placeholder || "Select"}</option>
      {options.map((option) => {
        const key = typeof option === "string" ? option : option.value;
        const label = typeof option === "string" ? option : option.label;
        return <option key={key} value={key}>{label}</option>;
      })}
    </select>
  );
}

function TextArea({ value, onChange, placeholder, minHeight = 104 }) {
  return <textarea value={value || ""} onChange={onChange} placeholder={placeholder || ""} style={{ width: "100%", minHeight, padding: "12px", borderRadius: 8, border: `1px solid ${THEME.border}`, boxSizing: "border-box", resize: "vertical", background: "#ffffff", color: THEME.text, outline: "none", fontSize: 13, fontFamily: "Inter, Arial, sans-serif", lineHeight: 1.55 }} />;
}

function ToggleField({ label, checked, onChange }) {
  return (
    <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: `1px solid ${THEME.borderSoft}`, borderRadius: 8, padding: 11, background: "#ffffff", gap: 10 }}>
      <span style={{ fontWeight: 700, fontSize: 13, color: THEME.text }}>{label}</span>
      <input type="checkbox" checked={Boolean(checked)} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function Card({ title, subtitle, children, action, compact }) {
  const width = useWindowWidth();
  const tight = width < 760;
  return (
    <section style={{ background: THEME.panel, border: `1px solid ${THEME.borderSoft}`, borderRadius: 8, padding: compact ? 16 : 22, boxShadow: "0 10px 24px rgba(16,24,40,0.05)" }}>
      {(title || action) ? <div style={{ display: "flex", flexDirection: tight ? "column" : "row", justifyContent: "space-between", gap: 16, marginBottom: children ? 18 : 0, alignItems: tight ? "stretch" : "flex-start" }}>
        <div>
          {title ? <h2 style={{ margin: 0, fontSize: compact ? 17 : 21, color: THEME.text, fontWeight: 800, letterSpacing: 0 }}>{title}</h2> : null}
          {subtitle ? <p style={{ margin: "7px 0 0 0", color: THEME.muted, fontSize: 13, lineHeight: 1.55 }}>{subtitle}</p> : null}
        </div>
        {action ? <div style={tight ? { display: "grid" } : null}>{action}</div> : null}
      </div> : null}
      {children}
    </section>
  );
}

function Badge({ children, tone }) {
  const colors = badgeColors(tone || children);
  return <span style={{ display: "inline-flex", alignItems: "center", padding: "5px 9px", borderRadius: 999, background: colors.bg, color: colors.color, fontSize: 11, fontWeight: 800, whiteSpace: "nowrap" }}>{children}</span>;
}

function Accordion({ title, subtitle, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: `1px solid ${THEME.borderSoft}`, borderRadius: 8, background: "#ffffff", overflow: "hidden" }}>
      <button type="button" onClick={() => setOpen((prev) => !prev)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 16px", border: "none", background: open ? THEME.panelAlt : "#ffffff", cursor: "pointer", textAlign: "left" }}>
        <span>
          <span style={{ display: "block", fontWeight: 800, color: THEME.text, fontSize: 14 }}>{title}</span>
          {subtitle ? <span style={{ display: "block", marginTop: 4, color: THEME.muted, fontSize: 12 }}>{subtitle}</span> : null}
        </span>
        <span style={{ color: THEME.muted, fontWeight: 900 }}>{open ? "Hide" : "Show"}</span>
      </button>
      {open ? <div style={{ padding: 16, borderTop: `1px solid ${THEME.borderSoft}` }}>{children}</div> : null}
    </div>
  );
}

function EmailDocument({ title, subject, body, to, onOpenDraft }) {
  const width = useWindowWidth();
  const tight = width < 980;
  return (
    <div style={{ border: `1px solid ${THEME.borderSoft}`, borderRadius: 8, overflow: "hidden", background: "#ffffff" }}>
      <div style={{ padding: 14, background: THEME.panelAlt, borderBottom: `1px solid ${THEME.borderSoft}`, display: "flex", flexDirection: tight ? "column" : "row", alignItems: tight ? "stretch" : "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 900, color: THEME.text, fontSize: 14 }}>{title}</div>
          <div style={{ marginTop: 6, color: THEME.muted, fontSize: 13 }}><strong>Subject:</strong> {subject}</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: tight ? "flex-start" : "flex-end" }}>
          <Button subtle onClick={() => safeCopy(subject)} style={tight ? { flex: "1 1 120px" } : null}>Copy Subject</Button>
          <Button subtle onClick={() => safeCopy(body)} style={tight ? { flex: "1 1 120px" } : null}>Copy Email</Button>
          <Button subtle onClick={() => downloadTextFile(`${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.txt`, `Subject: ${subject || ""}${NL}${NL}${body || ""}`)} style={tight ? { flex: "1 1 120px" } : null}>Download</Button>
          {subject || body ? <a href={mailtoLink(to, subject, body)} onClick={onOpenDraft} style={{ textDecoration: "none", flex: tight ? "1 1 120px" : "0 0 auto" }}><Button primary style={{ width: "100%" }}>Open Draft</Button></a> : null}
        </div>
      </div>
      <div style={{ padding: 18, color: THEME.text, fontSize: 14, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{body}</div>
    </div>
  );
}

function EmptyState({ children }) {
  return <div style={{ border: `1px dashed ${THEME.border}`, borderRadius: 8, padding: 24, textAlign: "center", color: THEME.muted, background: THEME.panelAlt }}>{children}</div>;
}

function MiniStat({ label, value, tone, onClick }) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper type={onClick ? "button" : undefined} onClick={onClick} style={{ width: "100%", textAlign: "left", border: `1px solid ${THEME.borderSoft}`, borderRadius: 8, padding: 14, background: "#ffffff", cursor: onClick ? "pointer" : "default", fontFamily: "Inter, Arial, sans-serif" }}>
      <div style={{ color: THEME.muted, textTransform: "uppercase", fontSize: 10, fontWeight: 900, letterSpacing: 0.4 }}>{label}</div>
      <div style={{ marginTop: 7, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <strong style={{ fontSize: 24, color: THEME.text }}>{value}</strong>
        {tone ? <Badge tone={tone}>{tone}</Badge> : null}
      </div>
    </Wrapper>
  );
}

function SectionHeader({ title, subtitle }) {
  return <div style={{ marginBottom: 12 }}><h3 style={{ margin: 0, fontSize: 16, color: THEME.text }}>{title}</h3>{subtitle ? <p style={{ margin: "5px 0 0", color: THEME.muted, fontSize: 13 }}>{subtitle}</p> : null}</div>;
}

function TagListEditor({ label, values, onChange }) {
  const [draft, setDraft] = useState("");
  function addValue() {
    const clean = draft.trim();
    if (!clean || values.includes(clean)) return;
    onChange([...values, clean]);
    setDraft("");
  }
  return (
    <div style={{ border: `1px solid ${THEME.borderSoft}`, borderRadius: 8, padding: 14, background: "#ffffff" }}>
      <div style={{ marginBottom: 10, fontSize: 13, fontWeight: 800, color: THEME.text }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        {values.map((value) => <span key={value} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 9px", borderRadius: 999, background: THEME.slateBg, fontSize: 12, border: `1px solid ${THEME.borderSoft}` }}>{value}<button type="button" aria-label={`Remove ${value}`} title={`Remove ${value}`} onClick={() => onChange(values.filter((item) => item !== value))} style={{ border: "none", background: "transparent", cursor: "pointer", color: THEME.muted, fontWeight: 900 }}>x</button></span>)}
      </div>
      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr auto" }}><TextInput value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Add option" /><Button onClick={addValue}>Add</Button></div>
    </div>
  );
}

export default function App() {
  const viewportWidth = useWindowWidth();
  const [activePage, setActivePage] = useState("submission");
  const [activeSettingsTab, setActiveSettingsTab] = useState("general");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [form, setForm] = useState(DEMO_FORM);
  const [submissionDate, setSubmissionDate] = useState(todayIso());
  const [tracker, setTracker] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [output, setOutput] = useState(null);
  const [notesText, setNotesText] = useState("");
  const [notesPreview, setNotesPreview] = useState(null);
  const [weeklyReport, setWeeklyReport] = useState("");
  const [weeklySubject, setWeeklySubject] = useState("Weekly Submission Summary");
  const [copyNotice, setCopyNotice] = useState("");
  const [trackerSearch, setTrackerSearch] = useState("");
  const [trackerStatusFilter, setTrackerStatusFilter] = useState("Active");
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    const loadedSettings = mergeDefaults(DEFAULT_SETTINGS, loadStoredValue(STORAGE_KEY, DEFAULT_SETTINGS));
    setSettings(loadedSettings);
    setTracker(migrateTrackerRecords(loadStoredValue(TRACKER_KEY, []), loadedSettings));
    setHistory(loadStoredValue(HISTORY_KEY, []));
    setNotesText(loadStoredValue(NOTES_KEY, ""));
    setHasLoaded(true);
  }, []);

  useEffect(() => {
    function onCopied(event) {
      setCopyNotice(event.detail || "Copied");
      window.clearTimeout(onCopied.timeoutId);
      onCopied.timeoutId = window.setTimeout(() => setCopyNotice(""), 1800);
    }
    window.addEventListener("welcomeflow-copy", onCopied);
    return () => {
      window.removeEventListener("welcomeflow-copy", onCopied);
      window.clearTimeout(onCopied.timeoutId);
    };
  }, []);

  useEffect(() => { if (hasLoaded) saveStoredValue(STORAGE_KEY, settings); }, [settings, hasLoaded]);
  useEffect(() => { if (hasLoaded) saveStoredValue(TRACKER_KEY, tracker); }, [tracker, hasLoaded]);
  useEffect(() => { if (hasLoaded) saveStoredValue(HISTORY_KEY, history); }, [history, hasLoaded]);
  useEffect(() => { if (hasLoaded) saveStoredValue(NOTES_KEY, notesText); }, [notesText, hasLoaded]);

  const activeRoles = useMemo(() => settings.roles.filter((role) => role.status === "Active"), [settings.roles]);
  const activeSites = useMemo(() => settings.sites.filter((site) => site.status === "Active"), [settings.sites]);
  const activeRequisitions = useMemo(() => (settings.requisitions || []).filter((req) => req.status === "Active"), [settings.requisitions]);
  const selectedRole = useMemo(() => activeRoles.find((role) => role.positionTitle === form.position) || null, [activeRoles, form.position]);
  const selectedSite = useMemo(() => activeSites.find((site) => site.siteName === form.siteName) || null, [activeSites, form.siteName]);
  const isHealthcare = (form.roleCategory || selectedRole?.roleCategory) === "Healthcare";
  const showShift = !selectedRole || selectedRole.requiresShift;
  const showFte = !selectedRole || selectedRole.requiresFte;
  const showWorkExpectations = !selectedRole || selectedRole.requiresWorkExpectations;
  const selectedSubmission = tracker.find((item) => item.id === selectedId) || tracker[0] || null;
  const visibleOutput = output || selectedSubmission?.output || null;

  const estimatedComp = useMemo(() => {
    if (!settings.compensationStructure.enabled || !form.position) return "";
    const tier = tierFromYears(form.yearsExperience);
    const match = settings.compensationStructure.rules.find((rule) => {
      const scopeMatch = rule.scopeType === "Site Type" ? rule.scopeValue === (selectedSite?.siteType || "") : rule.scopeValue === form.siteName;
      const basisMatch = rule.basisType === "Flat" || rule.basisType === "Custom" || rule.experienceTier === tier;
      return rule.positionTitle === form.position && scopeMatch && basisMatch;
    });
    if (!match) return "";
    const extras = [];
    if (form.shiftPreference === "Night" && match.shiftDifferentialNight) extras.push(`Night: ${match.shiftDifferentialNight}`);
    if (form.shiftPreference === "Evening" && match.shiftDifferentialEvening) extras.push(`Evening: ${match.shiftDifferentialEvening}`);
    if ((form.weekendRequirement === "Required" || form.weekendRequirement === "Rotating") && match.shiftDifferentialWeekend) extras.push(`Weekend: ${match.shiftDifferentialWeekend}`);
    return extras.length ? `${match.baseAmount} base | ${extras.join(" | ")}` : match.baseAmount;
  }, [settings.compensationStructure, form.position, form.yearsExperience, form.siteName, form.shiftPreference, form.weekendRequirement, selectedSite]);

  const metrics = useMemo(() => {
    const active = tracker.filter((item) => !isClosedStatus(item.status));
    return {
      total: tracker.length,
      active: active.length,
      awaiting: tracker.filter((item) => item.status === "Awaiting Review" || item.nextAction === "Awaiting manager review").length,
      interview: tracker.filter((item) => item.status.includes("Interview")).length,
      placed: tracker.filter((item) => item.status === "Placed").length,
      rejected: tracker.filter((item) => item.status === "Rejected").length,
      highRisk: tracker.filter((item) => riskFor(item) === "High").length,
    };
  }, [tracker]);

  const sourceMetrics = useMemo(() => {
    const counts = {};
    tracker.forEach((item) => {
      const source = item.candidateSource || item.formSnapshot?.candidateSource || "Unspecified";
      counts[source] = (counts[source] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source));
  }, [tracker]);

  const actionQueues = useMemo(() => {
    const today = todayIso();
    const isOpen = (item) => !isClosedStatus(item.status);
    return {
      followUps: tracker.filter((item) => isOpen(item) && daysBetween(item.submissionDate) >= 2 && item.nextAction !== "No action needed"),
      upcomingInterviews: tracker.filter((item) => isOpen(item) && item.interviewDate && item.interviewDate >= today),
      completedToday: tracker.filter((item) => isOpen(item) && item.status === "Interview Completed" && item.interviewDate === today),
      feedbackRequired: tracker.filter((item) => isOpen(item) && (item.nextAction === "Request feedback" || item.status === "Interview Completed")),
    };
  }, [tracker]);

  const validationErrors = useMemo(() => {
    const errors = [];
    if (!form.fullName.trim()) errors.push("Candidate name is required.");
    if (!form.position) errors.push("Position is required.");
    if (!form.siteName) errors.push("Site / Facility is required.");
    if (!form.emailAddress && !form.phoneNumber) errors.push("Add at least one candidate contact method.");
    if (form.emailAddress && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.emailAddress)) errors.push("Candidate email format looks invalid.");
    if (isHealthcare && selectedRole?.requiresLicense && !form.licenseStatus) errors.push("License status is required for this role.");
    if (isHealthcare && selectedRole?.requiresCpr && !form.cprStatus) errors.push("CPR status is required for this role.");
    if (showShift && selectedRole?.requiresShift && !form.shiftPreference) errors.push("Shift preference is required for this role.");
    if (showFte && selectedRole?.requiresFte && !form.fte) errors.push("FTE is required for this role.");
    return errors;
  }, [form, isHealthcare, selectedRole, showFte, showShift]);

  const filteredTracker = useMemo(() => {
    const search = trackerSearch.trim().toLowerCase();
    return tracker.filter((item) => {
      const statusMatch = trackerStatusFilter === "All" || (trackerStatusFilter === "Active" ? !isClosedStatus(item.status) : item.status === trackerStatusFilter);
      const searchMatch = !search || [item.candidate, item.position, item.site, item.status, item.nextAction, item.owner].join(" ").toLowerCase().includes(search);
      return statusMatch && searchMatch;
    });
  }, [tracker, trackerSearch, trackerStatusFilter]);

  function updateForm(key, value) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "position") {
        const role = activeRoles.find((item) => item.positionTitle === value);
        if (role) next.roleCategory = role.roleCategory;
      }
      if (key === "siteName") {
        const site = activeSites.find((item) => item.siteName === value);
        if (site?.location && !prev.location) next.location = site.location;
      }
      return next;
    });
  }

  function applyRequisitionToForm(requisitionId) {
    const req = activeRequisitions.find((item) => item.id === requisitionId);
    if (!req) {
      updateForm("selectedRequisitionId", "");
      return;
    }
    const role = activeRoles.find((item) => item.positionTitle === req.positionTitle);
    const site = activeSites.find((item) => item.siteName === req.siteName);
    setForm((prev) => ({
      ...prev,
      selectedRequisitionId: req.id,
      reqNumber: req.reqNumber || prev.reqNumber,
      position: req.positionTitle || prev.position,
      roleCategory: role?.roleCategory || prev.roleCategory,
      siteName: req.siteName || prev.siteName,
      location: site?.location || prev.location,
      employmentType: req.employmentType || prev.employmentType,
      shiftPreference: req.shiftPreference || prev.shiftPreference,
      fte: req.fte || prev.fte,
    }));
  }

  function updateSettings(path, value) {
    setSettings((prev) => {
      const next = structuredClone(prev);
      let node = next;
      path.slice(0, -1).forEach((part) => {
        if (!node[part] || typeof node[part] !== "object") node[part] = {};
        node = node[part];
      });
      node[path[path.length - 1]] = value;
      return next;
    });
  }

  function addHistory(type, subject, body, trackerId = selectedId, meta = {}) {
    const source = tracker.find((item) => item.id === trackerId) || (selectedSubmission?.id === trackerId ? selectedSubmission : null);
    const entry = {
      id: makeId("hist"),
      trackerId,
      type,
      subject,
      body,
      candidate: meta.candidate || source?.candidate || form.fullName || "",
      facility: meta.facility || source?.site || form.siteName || "",
      timestamp: new Date().toISOString(),
    };
    setHistory((prev) => [entry, ...prev].slice(0, 200));
    return entry;
  }

  function credentialsLine() {
    if (!isHealthcare) return "";
    const values = [];
    if (form.licenseStatus) values.push(`License: ${form.licenseStatus}`);
    if (form.cprStatus) values.push(`CPR: ${form.cprStatus}`);
    if (form.licensedYear) values.push(`Licensed Since: ${form.licensedYear}`);
    return values.join(" | ");
  }

  function defaultHiringManagerBody(finalComp) {
    const facilityName = form.siteName || settings.general.companyName || "Hiring Team";
    const candidateName = form.fullName || "The candidate";
    const positionName = form.position || "N/A";
    const educationLine = settings.templates.includeEducation ? buildEducation(form) : "";
    const credentials = settings.templates.includeCredentials ? credentialsLine() : "";
    return [`Hello ${facilityName},`, "", settings.templates.introLine || "Please review the candidate details below.", "", settings.templates.includeSubmissionDate ? `Submission Date: ${displayDate(submissionDate)}` : "", "", "Candidate Summary", `- ${candidateName} | ${positionName} | ${fteLabel(form.fte)} | ${form.shiftPreference || "N/A"}`, `- Req Number: ${form.reqNumber || "N/A"} | Source: ${form.candidateSource || "N/A"}`, `- ${form.phoneNumber || "N/A"} | ${form.emailAddress || "N/A"}`, `- ${facilityName} | ${form.location || "N/A"}`, `- Compensation: ${form.compensationType || "Hourly"} | ${finalComp}`, "", "Experience Summary", `- ${candidateName} brings ${form.yearsExperience || "N/A"} years of experience as a ${positionName}. ${form.experienceNotes || ""}`.trim(), educationLine && educationLine !== "N/A" ? `- Education: ${educationLine}` : "", credentials ? `- ${credentials}` : "", "", "Availability", `- Available to start ${form.startAvailability || "N/A"}${form.startNotes ? `, with the following note: ${form.startNotes}` : ""}. Interview availability is ${form.interviewAvailability || "N/A"}.`, "", "Work Expectations", `- The candidate has confirmed a schedule of ${form.workSchedule || "N/A"}, with OT set to ${form.otRequirement || "N/A"}, weekend requirement set to ${form.weekendRequirement || "N/A"}, and on-call requirement set to ${form.onCallRequirement || "N/A"}.`, "", "Work Area", `- ${form.workArea || "N/A"}`, "", "Additional Notes", `${form.candidateNotes || ""} ${settings.templates.closingLine} ${settings.templates.followUpLine}`.trim(), "", settings.general.signOffName || settings.general.recruiterName || "", settings.general.signOffLine || ""].filter(Boolean).join(NL);
  }

  function defaultCandidateBody(finalComp) {
    const positionLine = `${form.position || "position"}${form.shiftPreference ? `, ${form.shiftPreference}` : ""}${form.employmentType ? `, ${form.employmentType}` : ""}`;
    return [`Hello ${form.fullName || "Candidate"},`, "", settings.templates.candidateEmailIntro, "", `Your profile has been submitted for the ${positionLine} position with ${form.siteName || "the facility"}.`, "", "Compensation Structure", `${form.compensationType || "Hourly"}: ${finalComp}`, "", "Next Steps", `- ${settings.templates.candidateEmailNextStep1}`, `- ${settings.templates.candidateEmailNextStep2}`, `- ${settings.templates.candidateEmailNextStep3}`, "", settings.templates.candidateEmailTiming, settings.templates.candidateEmailSupportLine, "", settings.general.signOffName || settings.general.recruiterName || "", settings.general.signOffLine || ""].filter(Boolean).join(NL);
  }

  function atsBlock(finalComp, long = false) {
    return [`Submittal Date: ${displayDate(submissionDate)}`, `Recruiter: ${settings.general.recruiterName || "N/A"}`, "", "Candidate Details", `- ${form.fullName || "N/A"} | ${form.position || "N/A"} | ${form.siteName || "N/A"}`, "", "Quick Snapshot", `- Req Number: ${form.reqNumber || "N/A"} | Source: ${form.candidateSource || "N/A"}`, `- ${form.yearsExperience || "N/A"} yrs | ${finalComp}`, `- Start ${form.startAvailability || "N/A"} | Interview ${form.interviewAvailability || "N/A"}`, `- ${form.workType || "N/A"} | ${fteLabel(form.fte)} | ${form.shiftPreference || "N/A"}`, "", "Work Expectations", `- Schedule: ${form.workSchedule || "N/A"} | OT: ${form.otRequirement || "N/A"} | Weekend: ${form.weekendRequirement || "N/A"} | On-Call: ${form.onCallRequirement || "N/A"}`, long ? "" : null, long ? "Notes" : null, long ? `- ${form.candidateNotes || "No additional notes"}` : null, "", "Status", "- Ready for submission"].filter(Boolean).join(NL);
  }

  function buildOutput() {
    const finalComp = form.compensationRequested || estimatedComp || "TBD";
    const values = tokenMap(form, settings, { submission_date: displayDate(submissionDate), final_compensation: finalComp });
    const hmSubjectDefault = `Strong Match: ${form.fullName || "Candidate"} | ${form.position || "Role"} | ${form.siteName || "Facility"}`;
    const candidateSubjectDefault = `Submission Confirmation: ${form.position || "Position"} | ${form.siteName || "Facility"}`;
    const hiringManagerSubject = settings.templates.hiringManager.useCustom && settings.templates.hiringManager.subject ? applyTokens(settings.templates.hiringManager.subject, values) : hmSubjectDefault;
    const hiringManagerEmail = settings.templates.hiringManager.useCustom && settings.templates.hiringManager.body ? applyTokens(settings.templates.hiringManager.body, values) : defaultHiringManagerBody(finalComp);
    const candidateSubject = settings.templates.candidateConfirmation.useCustom && settings.templates.candidateConfirmation.subject ? applyTokens(settings.templates.candidateConfirmation.subject, values) : candidateSubjectDefault;
    const candidateEmail = settings.templates.candidateConfirmation.useCustom && settings.templates.candidateConfirmation.body ? applyTokens(settings.templates.candidateConfirmation.body, values) : defaultCandidateBody(finalComp);
    return {
      submissionDate,
      finalComp,
      hiringManagerSubject,
      hiringManagerEmail,
      candidateSubject,
      candidateEmail,
      atsShort: atsBlock(finalComp, false),
      atsLong: atsBlock(finalComp, true),
    };
  }

  function generateOutput() {
    if (validationErrors.length) {
      setCopyNotice("Please fix required fields first");
      return;
    }
    const generated = buildOutput();
    const trackerId = makeId("sub");
    const trackerItem = {
      id: trackerId,
      candidate: form.fullName || "Unnamed Candidate",
      position: form.position || "N/A",
      site: form.siteName || "N/A",
      reqNumber: form.reqNumber || "",
      candidateSource: form.candidateSource || "",
      requisitionId: form.selectedRequisitionId || "",
      candidateEmail: form.emailAddress || "",
      managerEmail: selectedSite?.hiringManagerEmail || managerEmailFor(settings),
      submissionDate,
      status: "Submitted",
      owner: "Recruiter",
      nextAction: "Awaiting manager review",
      interviewDate: form.interviewDate || "",
      formSnapshot: { ...form },
      output: generated,
      archived: false,
      archiveOutcome: "",
      archiveReason: "",
      futureReviewStatus: "",
      archiveNotes: "",
      audit: [
        { id: makeId("audit"), timestamp: new Date().toISOString(), label: "Submission generated", detail: `${form.fullName || "Candidate"} submitted for ${form.position || "role"} on ${displayDate(submissionDate)}` },
      ],
    };
    setOutput({ ...generated, trackerId });
    setTracker((prev) => [trackerItem, ...prev].slice(0, 100));
    setSelectedId(trackerId);
    addHistory("Hiring Manager Email", generated.hiringManagerSubject, generated.hiringManagerEmail, trackerId, { candidate: trackerItem.candidate, facility: trackerItem.site });
    addHistory("Candidate Email", generated.candidateSubject, generated.candidateEmail, trackerId, { candidate: trackerItem.candidate, facility: trackerItem.site });
    addHistory("ATS Update", `ATS: ${form.fullName || "Candidate"}`, generated.atsShort, trackerId, { candidate: trackerItem.candidate, facility: trackerItem.site });
  }

  function exportTrackerCsv() {
    const rows = filteredTracker.map((item) => ({
      candidate: item.candidate,
      position: item.position,
      site: item.site,
      reqNumber: item.reqNumber || item.formSnapshot?.reqNumber || "",
      candidateSource: item.candidateSource || item.formSnapshot?.candidateSource || "",
      candidateEmail: item.candidateEmail,
      managerEmail: managerEmailFor(settings, item),
      submissionDate: item.submissionDate,
      status: item.status,
      owner: item.owner,
      nextAction: item.nextAction,
      interviewDate: item.interviewDate,
      risk: riskFor(item),
      agingDays: daysBetween(item.submissionDate),
      archiveOutcome: item.archiveOutcome,
      archiveReason: item.archiveReason,
    }));
    downloadTextFile("welcomeflow-tracker.csv", toCsv(rows, ["candidate", "position", "site", "reqNumber", "candidateSource", "candidateEmail", "managerEmail", "submissionDate", "status", "owner", "nextAction", "interviewDate", "risk", "agingDays", "archiveOutcome", "archiveReason"]), "text/csv");
  }

  function exportHistoryCsv() {
    const rows = history.map((item) => ({ type: item.type, timestamp: item.timestamp, subject: item.subject, candidate: item.candidate, facility: item.facility, trackerId: item.trackerId, body: item.body }));
    downloadTextFile("welcomeflow-email-history.csv", toCsv(rows, ["type", "timestamp", "subject", "candidate", "facility", "trackerId", "body"]), "text/csv");
  }

  function exportFullBackup() {
    const backup = {
      exportedAt: new Date().toISOString(),
      appName: BRAND.appName,
      version: "sprint-1",
      settings,
      tracker,
      history,
      notes: notesText,
    };
    downloadTextFile(`welcomeflow-backup-${todayIso()}.json`, JSON.stringify(backup, null, 2), "application/json");
  }

  function importFullBackup(text) {
    try {
      const data = JSON.parse(text);
      const nextSettings = mergeDefaults(DEFAULT_SETTINGS, data.settings || {});
      setSettings(nextSettings);
      setTracker(migrateTrackerRecords(data.tracker || [], nextSettings));
      setHistory(Array.isArray(data.history) ? data.history : []);
      setNotesText(typeof data.notes === "string" ? data.notes : "");
      setCopyNotice("Full backup imported");
    } catch {
      window.alert("Backup import failed. Please use a valid WelcomeFlow backup JSON file.");
    }
  }

  function updateTracker(id, key, value) {
    setTracker((prev) => prev.map((item) => {
      if (item.id !== id) return item;
      const derived = {};
      if (key === "status") {
        if (value === "Interview Scheduled") derived.nextAction = "Send interview reminder";
        if (value === "Interview Completed") derived.nextAction = "Request feedback";
        if (isClosedStatus(value)) {
          derived.nextAction = "No action needed";
          derived.archived = value === "Archived" ? true : item.archived;
        }
      }
      const audit = [...(item.audit || []), { id: makeId("audit"), timestamp: new Date().toISOString(), label: `${labelFromKey(key)} updated`, detail: String(value || "Blank") }];
      return { ...item, [key]: value, ...derived, audit };
    }));
  }

  function archiveCandidate(item) {
    if (!window.confirm(`Archive ${item.candidate}? This will move the candidate out of active workflow queues.`)) return;
    setTracker((prev) => prev.map((row) => row.id === item.id ? { ...row, status: "Archived", archived: true, nextAction: "No action needed", audit: [...(row.audit || []), { id: makeId("audit"), timestamp: new Date().toISOString(), label: "Candidate archived", detail: `${row.archiveOutcome || "No outcome"} | ${row.archiveReason || "No reason"}` }] } : row));
  }

  function restoreCandidate(item) {
    setTracker((prev) => prev.map((row) => row.id === item.id ? {
      ...row,
      status: row.status === "Archived" ? "Submitted" : row.status,
      archived: false,
      nextAction: row.nextAction === "No action needed" ? "Awaiting manager review" : row.nextAction,
      audit: [...(row.audit || []), { id: makeId("audit"), timestamp: new Date().toISOString(), label: "Candidate restored", detail: "Returned to active workflow queues" }],
    } : row));
  }

  function makeTemplateEmail(item, templateKey, typeLabel) {
    const snapshot = item.formSnapshot || {};
    const template = settings.templates[templateKey] || DEFAULT_SETTINGS.templates[templateKey] || {};
    const values = tokenMap(snapshot, settings, { status: item.status, nextAction: item.nextAction, submissionDate: item.submissionDate });
    const subject = applyTokens(template.subject || typeLabel, values);
    const body = applyTokens(template.body || "", values);
    addHistory(typeLabel, subject, body, item.id);
    return { subject, body };
  }

  function buildAtsUpdateForItem(item) {
    const template = settings.templates.atsUpdate;
    if (template?.useCustom && template.body) {
      const values = tokenMap(item.formSnapshot || {}, settings, { status: item.status, nextAction: item.nextAction, submissionDate: item.submissionDate });
      return {
        subject: applyTokens(template.subject || `ATS Update: ${item.candidate}`, values),
        body: applyTokens(template.body, values),
      };
    }
    return { subject: `ATS: ${item.candidate}`, body: item.output?.atsShort || "" };
  }

  function openCandidateDraft(item) {
    const subject = item.output?.candidateSubject || `Submission Confirmation: ${item.position}`;
    const body = item.output?.candidateEmail || "";
    addHistory("Candidate Email Opened", subject, body, item.id, { candidate: item.candidate, facility: item.site });
    window.location.href = mailtoLink(item.candidateEmail, subject, body);
  }

  function openManagerDraft(item) {
    const email = makeTemplateEmail(item, "managerFeedbackRequest", "Manager Feedback Request");
    addHistory("Hiring Manager Draft Opened", email.subject, email.body, item.id, { candidate: item.candidate, facility: item.site });
    window.location.href = mailtoLink(managerEmailFor(settings, item), email.subject, email.body);
  }

  function handleTrackerAction(item, action) {
    if (action === "details") {
      setSelectedId(item.id);
      setActivePage("review");
    }
    if (action === "generateAts") {
      const ats = buildAtsUpdateForItem(item);
      addHistory("ATS Update", ats.subject, ats.body, item.id, { candidate: item.candidate, facility: item.site });
      setCopyNotice("ATS update generated");
    }
    if (action === "copyAts") {
      const ats = buildAtsUpdateForItem(item);
      addHistory("ATS Update", ats.subject, ats.body, item.id, { candidate: item.candidate, facility: item.site });
      safeCopy(ats.body);
    }
    if (action === "openManager") openManagerDraft(item);
    if (action === "openCandidate") openCandidateDraft(item);
    if (action === "archive") archiveCandidate(item);
  }

  function bulkManagerFeedbackEmail() {
    const rows = actionQueues.feedbackRequired;
    if (!rows.length) return;
    const body = rows.map((item) => `- ${item.candidate} | ${item.position} | ${item.site} | Submitted ${displayDate(item.submissionDate)}`).join(NL);
    const email = `Hello,\n\nPlease send manager feedback for the following candidates:\n\n${body}\n\nThank you,\n${settings.general.signOffName || settings.general.recruiterName || ""}`;
    addHistory("Bulk Manager Feedback", "Manager feedback needed", email, "");
    safeCopy(email);
  }

  function markFollowedUp(item) {
    updateTracker(item.id, "nextAction", "Awaiting manager review");
    const generated = makeTemplateEmail(item, "candidate48HourFollowUp", "Follow-Up Email");
    safeCopy(generated.body);
  }

  function parseNotesPreview() {
    const text = notesText;
    if (!text.trim()) {
      setNotesPreview(null);
      return;
    }
    const cleanValue = (value) => String(value || "").split("|")[0].trim();
    const find = (regex) => cleanValue(text.match(regex)?.[1]);
    const preview = {
      fullName: find(/(?:name|candidate)[:-]\s*([^\n|]+)/i) || form.fullName,
      phoneNumber: find(/(?:phone|cell|mobile)[:-]\s*([^\n|]+)/i) || cleanValue(text.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/)?.[0]) || form.phoneNumber,
      emailAddress: find(/(?:email)[:-]\s*([^\n|]+)/i) || cleanValue(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]) || form.emailAddress,
      position: find(/(?:role|position)[:-]\s*([^\n|]+)/i) || form.position,
      yearsExperience: find(/(\d+)\s*(?:years|yrs)/i) || form.yearsExperience,
      shiftPreference: find(/(?:shift)[:-]\s*([^\n|]+)/i) || form.shiftPreference,
      startAvailability: find(/(?:start|availability)[:-]\s*([^\n|]+)/i) || form.startAvailability,
      licenseStatus: /active/i.test(text) ? "Active/Clear" : form.licenseStatus,
      cprStatus: /cpr[^.\n]*(active|current|valid)/i.test(text) ? "Active" : form.cprStatus,
      workSchedule: find(/(?:schedule)[:-]\s*([^\n|]+)/i) || form.workSchedule,
      candidateNotes: text.slice(0, 600),
    };
    setNotesPreview(preview);
  }

  function applyNotesPreview() {
    if (!notesPreview) return;
    setForm((prev) => ({ ...prev, ...notesPreview }));
  }

  function generateWeeklyReport() {
    const weeklyRows = tracker.filter((item) => isThisWeek(item.submissionDate));
    const weeklyMetrics = {
      total: weeklyRows.length,
      active: weeklyRows.filter((item) => !isClosedStatus(item.status)).length,
      awaiting: weeklyRows.filter((item) => item.status === "Awaiting Review" || item.nextAction === "Awaiting manager review").length,
      interview: weeklyRows.filter((item) => item.status.includes("Interview")).length,
      placed: weeklyRows.filter((item) => item.status === "Placed").length,
      rejected: weeklyRows.filter((item) => item.status === "Rejected").length,
      highRisk: weeklyRows.filter((item) => riskFor(item) === "High").length,
    };
    const highRiskRows = weeklyRows.filter((item) => riskFor(item) === "High").map((item) => `- ${item.candidate} | ${item.position} | ${item.site} | ${daysBetween(item.submissionDate)} days old`);
    const defaultReport = [`Weekly Submission Summary`, `Generated: ${displayDate(todayIso())}`, "", `Submitted This Week: ${weeklyMetrics.total}`, `Active This Week: ${weeklyMetrics.active}`, `Awaiting Review: ${weeklyMetrics.awaiting}`, `Interview Activity: ${weeklyMetrics.interview}`, `Placed: ${weeklyMetrics.placed}`, `Rejected: ${weeklyMetrics.rejected}`, `High Risk: ${weeklyMetrics.highRisk}`, "", "High Risk Candidates", ...(highRiskRows.length ? highRiskRows : ["- None"])].join(NL);
    const reportValues = tokenMap(form, settings, { ...weeklyMetrics, totalSubmitted: weeklyMetrics.total });
    const report = settings.templates.weeklyReport?.useCustom && settings.templates.weeklyReport.body ? applyTokens(settings.templates.weeklyReport.body, reportValues) : defaultReport;
    const subject = settings.templates.weeklyReport?.useCustom && settings.templates.weeklyReport.subject ? applyTokens(settings.templates.weeklyReport.subject, reportValues) : "Weekly Submission Summary";
    setWeeklyReport(report);
    setWeeklySubject(subject);
    addHistory("Weekly Report", subject, report, "");
  }

  const isNarrow = viewportWidth < 900;
  const isMedium = viewportWidth < 1180;
  const pageStyle = { minHeight: "100vh", background: THEME.pageBg, color: THEME.text, fontFamily: "Inter, Arial, sans-serif", fontSize: 13 };
  const shellStyle = { maxWidth: 1440, margin: "0 auto", padding: isNarrow ? 14 : 24 };
  const fieldGrid = { display: "grid", gap: 14, gridTemplateColumns: isNarrow ? "1fr" : "repeat(2, minmax(0, 1fr))" };
  const threeGrid = { display: "grid", gap: 14, gridTemplateColumns: isNarrow ? "1fr" : "repeat(3, minmax(0, 1fr))" };

  const nav = [
    ["submission", "Submission"],
    ["tracker", "Tracker"],
    ["review", "Review Details"],
    ["actions", "Action Center"],
    ["metrics", "Metrics"],
    ["settings", "Settings"],
  ];

  return (
    <div style={pageStyle}>
      <div style={shellStyle}>
        <Card compact>
          <div style={{ display: "grid", gap: 18, gridTemplateColumns: isMedium ? "1fr" : "1fr auto", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: isNarrow ? 24 : 28, letterSpacing: 0, color: THEME.primary }}>{BRAND.appName} <span style={{ color: THEME.text, fontWeight: 700 }}>{BRAND.product}</span></div>
              <div style={{ marginTop: 6, color: THEME.muted, fontSize: 14 }}>{BRAND.tagline}</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: isMedium ? "flex-start" : "flex-end" }}>
              {nav.map(([key, label]) => <Button key={key} primary={activePage === key} subtle={activePage !== key} onClick={() => setActivePage(key)} style={isNarrow ? { flex: "1 1 130px" } : null}>{label}</Button>)}
            </div>
          </div>
        </Card>

        <div style={{ display: "grid", gap: 14, gridTemplateColumns: viewportWidth < 560 ? "1fr" : isMedium ? "repeat(2, minmax(0, 1fr))" : "repeat(4, minmax(0, 1fr))", margin: "16px 0 22px" }}>
          <MiniStat label="Active Pipeline" value={metrics.active} />
          <MiniStat label="Follow-Ups" value={actionQueues.followUps.length} tone={actionQueues.followUps.length ? "Medium" : "Low"} onClick={() => setActivePage("actions")} />
          <MiniStat label="Feedback Needed" value={actionQueues.feedbackRequired.length} tone={actionQueues.feedbackRequired.length ? "High" : "Low"} onClick={() => setActivePage("actions")} />
          <MiniStat label="High Risk" value={metrics.highRisk} tone={metrics.highRisk ? "High" : "Low"} onClick={() => setActivePage("tracker")} />
        </div>

        {activePage === "submission" ? (
          <div style={{ display: "grid", gap: 18, gridTemplateColumns: isMedium ? "1fr" : "1.08fr 0.92fr", alignItems: "start" }}>
            <div style={{ display: "grid", gap: 18 }}>
              <Card title="Candidate Intake" subtitle="Auto-filled submission date, notes preview, work expectations, and compensation logic stay editable.">
                <div style={fieldGrid}>
                  <Field label="Submission Date"><TextInput type="date" value={submissionDate} onChange={(event) => setSubmissionDate(event.target.value)} /></Field>
                  <Field label="Active Requisition"><SelectInput value={form.selectedRequisitionId} onChange={(event) => applyRequisitionToForm(event.target.value)} options={activeRequisitions.map((req) => ({ value: req.id, label: `${req.reqNumber || "No Req"} | ${req.positionTitle || "No Position"} | ${req.siteName || "No Site"}` }))} placeholder="Optional: select active req" /></Field>
                  <Field label="Req Number"><TextInput value={form.reqNumber} onChange={(event) => updateForm("reqNumber", event.target.value)} placeholder="Manual entry allowed" /></Field>
                  <Field label="Candidate Source"><SelectInput value={form.candidateSource} onChange={(event) => updateForm("candidateSource", event.target.value)} options={settings.options.candidateSourceOptions || SOURCE_OPTIONS} placeholder="Select source" /></Field>
                  <Field label="Position"><SelectInput value={form.position} onChange={(event) => updateForm("position", event.target.value)} options={activeRoles.map((role) => role.positionTitle)} placeholder="Select role" /></Field>
                  <Field label="Role Category"><SelectInput value={form.roleCategory || selectedRole?.roleCategory || ""} onChange={(event) => updateForm("roleCategory", event.target.value)} options={settings.options.roleTypes} /></Field>
                  <Field label="Site / Facility"><SelectInput value={form.siteName} onChange={(event) => updateForm("siteName", event.target.value)} options={activeSites.map((site) => site.siteName)} /></Field>
                  <Field label="Full Name"><TextInput value={form.fullName} onChange={(event) => updateForm("fullName", event.target.value)} /></Field>
                  <Field label="Email Address"><TextInput value={form.emailAddress} onChange={(event) => updateForm("emailAddress", event.target.value)} /></Field>
                  <Field label="Phone Number"><TextInput value={form.phoneNumber} onChange={(event) => updateForm("phoneNumber", event.target.value)} /></Field>
                  <Field label="Location"><TextInput value={form.location} onChange={(event) => updateForm("location", event.target.value)} /></Field>
                  <Field label="Employment Type"><SelectInput value={form.employmentType} onChange={(event) => updateForm("employmentType", event.target.value)} options={settings.options.employmentTypes} /></Field>
                  {showShift ? <Field label="Shift Preference"><SelectInput value={form.shiftPreference} onChange={(event) => updateForm("shiftPreference", event.target.value)} options={settings.options.shiftOptions} /></Field> : null}
                  <Field label="Work Type"><SelectInput value={form.workType} onChange={(event) => updateForm("workType", event.target.value)} options={settings.options.workTypes} /></Field>
                  {showFte ? <Field label="FTE"><SelectInput value={form.fte} onChange={(event) => updateForm("fte", event.target.value)} options={FTE_OPTIONS} /></Field> : null}
                  <Field label="Years of Experience"><TextInput type="number" value={form.yearsExperience} onChange={(event) => updateForm("yearsExperience", event.target.value)} /></Field>
                  <Field label="Education"><SelectInput value={form.educationLevel} onChange={(event) => updateForm("educationLevel", event.target.value)} options={settings.options.educationLevels} /></Field>
                  <Field label="Field of Study"><TextInput value={form.fieldOfStudy} onChange={(event) => updateForm("fieldOfStudy", event.target.value)} /></Field>
                  <Field label="Compensation Type"><SelectInput value={form.compensationType} onChange={(event) => updateForm("compensationType", event.target.value)} options={["Hourly", "Salary"]} /></Field>
                  <Field label="Compensation Requested"><TextInput value={form.compensationRequested} onChange={(event) => updateForm("compensationRequested", event.target.value)} placeholder="Optional override" /></Field>
                  <Field label="Estimated Compensation"><TextInput value={estimatedComp} readOnly /></Field>
                  <Field label="Start Date"><SelectInput value={form.startAvailability} onChange={(event) => updateForm("startAvailability", event.target.value)} options={settings.options.startAvailabilityOptions} /></Field>
                  <Field label="Interview Availability"><TextInput value={form.interviewAvailability} onChange={(event) => updateForm("interviewAvailability", event.target.value)} /></Field>
                  <Field label="Interview Date"><TextInput type="date" value={form.interviewDate} onChange={(event) => updateForm("interviewDate", event.target.value)} /></Field>
                  {isHealthcare ? <Field label="License Status"><SelectInput value={form.licenseStatus} onChange={(event) => updateForm("licenseStatus", event.target.value)} options={settings.options.licenseStatusOptions} /></Field> : null}
                  {isHealthcare ? <Field label="CPR Status"><SelectInput value={form.cprStatus} onChange={(event) => updateForm("cprStatus", event.target.value)} options={settings.options.cprStatusOptions} /></Field> : null}
                  {isHealthcare ? <Field label="Licensed Year"><TextInput value={form.licensedYear} onChange={(event) => updateForm("licensedYear", event.target.value)} /></Field> : null}
                  <div style={{ gridColumn: "1 / -1" }}><Field label="Experience Notes"><TextArea value={form.experienceNotes} onChange={(event) => updateForm("experienceNotes", event.target.value)} /></Field></div>
                  <div style={{ gridColumn: "1 / -1" }}><Field label="Start Date Notes"><TextArea value={form.startNotes} onChange={(event) => updateForm("startNotes", event.target.value)} minHeight={78} /></Field></div>
                </div>
                {showWorkExpectations ? <div style={{ marginTop: 18 }}>
                  <SectionHeader title="Work Expectations" subtitle="Position-based details feed the email, ATS block, tracker, and review details." />
                  <div style={fieldGrid}>
                    <Field label="Work Schedule"><TextInput value={form.workSchedule} onChange={(event) => updateForm("workSchedule", event.target.value)} /></Field>
                    <Field label="Work Area"><TextInput value={form.workArea} onChange={(event) => updateForm("workArea", event.target.value)} /></Field>
                    <Field label="OT Requirement"><SelectInput value={form.otRequirement} onChange={(event) => updateForm("otRequirement", event.target.value)} options={settings.options.workExpectationOptions.ot} /></Field>
                    <Field label="Weekend Requirement"><SelectInput value={form.weekendRequirement} onChange={(event) => updateForm("weekendRequirement", event.target.value)} options={settings.options.workExpectationOptions.weekend} /></Field>
                    <Field label="On-Call Requirement"><SelectInput value={form.onCallRequirement} onChange={(event) => updateForm("onCallRequirement", event.target.value)} options={settings.options.workExpectationOptions.onCall} /></Field>
                  </div>
                  <div style={{ display: "grid", gap: 10, gridTemplateColumns: isNarrow ? "1fr" : "repeat(4, minmax(0, 1fr))", marginTop: 12 }}>
                    <ToggleField label="Schedule" checked={form.scheduleConfirmed} onChange={(value) => updateForm("scheduleConfirmed", value)} />
                    <ToggleField label="OT" checked={form.otConfirmed} onChange={(value) => updateForm("otConfirmed", value)} />
                    <ToggleField label="Weekend" checked={form.weekendConfirmed} onChange={(value) => updateForm("weekendConfirmed", value)} />
                    <ToggleField label="On-Call" checked={form.onCallConfirmed} onChange={(value) => updateForm("onCallConfirmed", value)} />
                  </div>
                </div> : null}
                <div style={{ marginTop: 18 }}><Field label="Candidate Notes"><TextArea value={form.candidateNotes} onChange={(event) => updateForm("candidateNotes", event.target.value)} /></Field></div>
                {validationErrors.length ? <div style={{ marginTop: 14, border: `1px solid #fecdca`, background: THEME.redBg, color: THEME.red, borderRadius: 8, padding: 12, fontWeight: 700 }}>{validationErrors.map((error) => <div key={error}>• {error}</div>)}</div> : null}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
                  <Button primary onClick={generateOutput}>Generate Output + Tracker Record</Button>
                  <Button subtle onClick={() => setForm(DEMO_FORM)}>Load Demo</Button>
                  <Button danger onClick={() => { setForm(DEFAULT_FORM); setOutput(null); }}>Clear Form</Button>
                </div>
              </Card>

              <Card title="Notes-to-Profile Preview" subtitle="Paste recruiter notes, preview extracted data, then apply only when it looks right.">
                <div style={{ display: "grid", gap: 14, gridTemplateColumns: isNarrow ? "1fr" : "1fr 1fr" }}>
                  <div><Field label="Recruiter Notes / Transcript"><TextArea value={notesText} onChange={(event) => setNotesText(event.target.value)} placeholder="Example: Name: Ashley Martin | Role: Registered Nurse | 10 yrs experience | Shift: Day" minHeight={180} /></Field><div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}><Button primary onClick={parseNotesPreview}>Preview Extracted Data</Button><Button subtle onClick={() => setNotesPreview(null)}>Clear Preview</Button></div></div>
                  <div style={{ border: `1px solid ${THEME.borderSoft}`, borderRadius: 8, padding: 14, background: THEME.panelAlt }}><h3 style={{ marginTop: 0 }}>Extracted Preview</h3>{notesPreview ? <pre style={{ whiteSpace: "pre-wrap", fontFamily: "Inter, Arial, sans-serif", lineHeight: 1.6 }}>{JSON.stringify(notesPreview, null, 2)}</pre> : <EmptyState>No preview yet.</EmptyState>}{notesPreview ? <Button primary onClick={applyNotesPreview}>Apply to Form</Button> : null}</div>
                </div>
              </Card>
            </div>

            <div style={{ position: isMedium ? "static" : "sticky", top: 18 }}>
              <Card title="Generated Output" subtitle="Styled like documents, with visible subjects and Outlook-ready links.">
                {!visibleOutput ? <EmptyState>Generate a submission to see emails, ATS blocks, and tracking history.</EmptyState> : <div style={{ display: "grid", gap: 14 }}>
                  <EmailDocument title="Hiring Manager Submission" subject={visibleOutput.hiringManagerSubject} body={visibleOutput.hiringManagerEmail} to={managerEmailFor(settings, selectedSubmission || {})} onOpenDraft={() => addHistory("Hiring Manager Draft Opened", visibleOutput.hiringManagerSubject, visibleOutput.hiringManagerEmail, visibleOutput.trackerId)} />
                  <EmailDocument title="Candidate Confirmation" subject={visibleOutput.candidateSubject} body={visibleOutput.candidateEmail} to={form.emailAddress || selectedSubmission?.candidateEmail} onOpenDraft={() => addHistory("Candidate Draft Opened", visibleOutput.candidateSubject, visibleOutput.candidateEmail, visibleOutput.trackerId)} />
                  <Accordion title="ATS Short Update" defaultOpen><pre style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{visibleOutput.atsShort}</pre><div style={{ marginTop: 10 }}><Button subtle onClick={() => safeCopy(visibleOutput.atsShort)}>Copy ATS Short</Button></div></Accordion>
                  <Accordion title="ATS Long Update"><pre style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{visibleOutput.atsLong}</pre><div style={{ marginTop: 10 }}><Button subtle onClick={() => safeCopy(visibleOutput.atsLong)}>Copy ATS Long</Button></div></Accordion>
                </div>}
              </Card>
            </div>
          </div>
        ) : null}

        {activePage === "tracker" ? (
          <Card title="Submission Tracker Control Tower" subtitle="Status, owner, next action, aging, risk, and quick actions stay in one clean table." action={<Button subtle onClick={exportTrackerCsv} disabled={!filteredTracker.length}>Export CSV</Button>}>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: isNarrow ? "1fr" : "1fr 220px", marginBottom: 14 }}>
              <TextInput value={trackerSearch} onChange={(event) => setTrackerSearch(event.target.value)} placeholder="Search candidate, position, site, status, action..." />
              <SelectInput value={trackerStatusFilter} onChange={(event) => setTrackerStatusFilter(event.target.value)} options={["Active", "All", ...STATUS_OPTIONS]} />
            </div>
            {!filteredTracker.length ? <EmptyState>No submissions yet. Generate one from the Submission page.</EmptyState> : <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 10px", minWidth: 980 }}><thead><tr>{["Candidate", "Role / Site", "Status", "Owner", "Next Action", "Aging", "Risk", "Actions"].map((head) => <th key={head} style={{ textAlign: "left", color: THEME.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, padding: "0 10px" }}>{head}</th>)}</tr></thead><tbody>{filteredTracker.map((item) => <tr key={item.id} style={{ background: "#ffffff", boxShadow: "0 6px 18px rgba(16,24,40,0.04)" }}><td style={{ padding: 10, borderTopLeftRadius: 8, borderBottomLeftRadius: 8 }}><strong>{item.candidate}</strong><div style={{ marginTop: 4, color: THEME.muted }}>{item.candidateEmail || "No email"}</div></td><td style={{ padding: 10 }}><strong>{item.position}</strong><div style={{ marginTop: 4, color: THEME.muted }}>{item.site}</div></td><td style={{ padding: 10 }}><SelectInput value={item.status} onChange={(event) => updateTracker(item.id, "status", event.target.value)} options={STATUS_OPTIONS} /></td><td style={{ padding: 10 }}><SelectInput value={item.owner} onChange={(event) => updateTracker(item.id, "owner", event.target.value)} options={OWNER_OPTIONS} /></td><td style={{ padding: 10 }}><SelectInput value={item.nextAction} onChange={(event) => updateTracker(item.id, "nextAction", event.target.value)} options={NEXT_ACTION_OPTIONS} /></td><td style={{ padding: 10 }}>{daysBetween(item.submissionDate)} days</td><td style={{ padding: 10 }}><Badge tone={riskFor(item)}>{riskFor(item)}</Badge></td><td style={{ padding: 10, borderTopRightRadius: 8, borderBottomRightRadius: 8 }}><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><Button subtle onClick={() => handleTrackerAction(item, "details")}>Details</Button><Button subtle onClick={() => handleTrackerAction(item, "copyAts")}>ATS</Button><Button subtle onClick={() => handleTrackerAction(item, "openCandidate")} disabled={!item.candidateEmail}>Candidate</Button><Button subtle onClick={() => handleTrackerAction(item, "openManager")}>Manager</Button><Button danger onClick={() => handleTrackerAction(item, "archive")}>Archive</Button></div></td></tr>)}</tbody></table></div>}
          </Card>
        ) : null}

        {activePage === "review" ? (
          <div style={{ display: "grid", gap: 18, gridTemplateColumns: isMedium ? "1fr" : "320px 1fr", alignItems: "start" }}>
            <Card title="Review Queue" compact>
              {!tracker.length ? <EmptyState>No records.</EmptyState> : <div style={{ display: "grid", gap: 8 }}>{tracker.map((item) => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} style={{ textAlign: "left", border: `1px solid ${selectedSubmission?.id === item.id ? THEME.primary2 : THEME.borderSoft}`, borderRadius: 8, padding: 10, background: selectedSubmission?.id === item.id ? THEME.blueBg : "#ffffff", cursor: "pointer" }}><strong>{item.candidate}</strong><div style={{ color: THEME.muted, marginTop: 4 }}>{item.position} | {item.site}</div></button>)}</div>}
            </Card>
            <Card title="Review Details" subtitle="Audit stays visible; histories and resend tools are tucked into dropdown sections.">
              {!selectedSubmission ? <EmptyState>Select a tracker record.</EmptyState> : <div style={{ display: "grid", gap: 14 }}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "space-between" }}>
                  <div><h2 style={{ margin: 0 }}>{selectedSubmission.candidate}</h2><p style={{ margin: "6px 0 0", color: THEME.muted }}>{selectedSubmission.position} | {selectedSubmission.site} | Submitted {displayDate(selectedSubmission.submissionDate)}</p></div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Badge tone={riskFor(selectedSubmission)}>{riskFor(selectedSubmission)} Risk</Badge><Badge>{selectedSubmission.status}</Badge></div>
                </div>
                <Accordion title="Candidate Snapshot" subtitle="Contact, submission, and intake details for quick review." defaultOpen>
                  <div style={{ display: "grid", gap: 10, gridTemplateColumns: isNarrow ? "1fr" : "repeat(2, minmax(0, 1fr))" }}>
                    {[
                      ["Candidate", selectedSubmission.candidate],
                      ["Candidate Email", selectedSubmission.candidateEmail],
                      ["Manager Email", managerEmailFor(settings, selectedSubmission)],
                      ["Req Number", selectedSubmission.reqNumber || selectedSubmission.formSnapshot?.reqNumber],
                      ["Candidate Source", selectedSubmission.candidateSource || selectedSubmission.formSnapshot?.candidateSource],
                      ["Submitted", displayDate(selectedSubmission.submissionDate)],
                      ["Phone", selectedSubmission.formSnapshot?.phoneNumber],
                      ["Location", selectedSubmission.formSnapshot?.location],
                      ["Experience", selectedSubmission.formSnapshot?.yearsExperience ? `${selectedSubmission.formSnapshot.yearsExperience} years` : ""],
                      ["Compensation", selectedSubmission.output?.finalComp],
                    ].map(([label, value]) => <div key={label} style={{ border: `1px solid ${THEME.borderSoft}`, borderRadius: 8, padding: 11, background: THEME.panelAlt }}><strong>{label}</strong><div style={{ marginTop: 5, color: THEME.muted }}>{value || "Not provided"}</div></div>)}
                  </div>
                </Accordion>
                <Card title="Audit Timeline" compact>
                  <div style={{ display: "grid", gap: 10 }}>{(selectedSubmission.audit || []).map((event) => <div key={event.id} style={{ display: "grid", gap: 4, borderLeft: `3px solid ${THEME.primary2}`, paddingLeft: 12 }}><strong>{event.label}</strong><span style={{ color: THEME.muted }}>{new Date(event.timestamp).toLocaleString()} | {event.detail}</span></div>)}</div>
                </Card>
                <Accordion title="ATS Updates" subtitle="Timestamped ATS blocks and copy-ready notes.">
                  <HistoryList rows={history.filter((item) => item.trackerId === selectedSubmission.id && item.type.includes("ATS"))} />
                </Accordion>
                <Accordion title="Hiring Manager Email History" subtitle="Generated manager messages and feedback requests.">
                  <HistoryList rows={history.filter((item) => item.trackerId === selectedSubmission.id && (item.type.includes("Hiring Manager") || item.type.includes("Manager Feedback")))} to={managerEmailFor(settings, selectedSubmission)} />
                </Accordion>
                <Accordion title="Candidate Email History" subtitle="Confirmations, reminders, and follow-up email records.">
                  <HistoryList rows={history.filter((item) => item.trackerId === selectedSubmission.id && item.type.includes("Candidate"))} to={selectedSubmission.candidateEmail} />
                </Accordion>
                <Accordion title="Follow-Up Email History" subtitle="Copy and resend later from one place.">
                  <HistoryList rows={history.filter((item) => item.trackerId === selectedSubmission.id && item.type.includes("Follow-Up"))} to={selectedSubmission.candidateEmail} />
                </Accordion>
                <Accordion title="Archive Workflow" subtitle="Outcome, reason, future review status, and notes.">
                  <div style={fieldGrid}>
                    <Field label="Outcome"><SelectInput value={selectedSubmission.archiveOutcome} onChange={(event) => updateTracker(selectedSubmission.id, "archiveOutcome", event.target.value)} options={OUTCOME_OPTIONS} /></Field>
                    <Field label="Future Review Status"><SelectInput value={selectedSubmission.futureReviewStatus} onChange={(event) => updateTracker(selectedSubmission.id, "futureReviewStatus", event.target.value)} options={["Do not review", "Review in 30 days", "Review in 60 days", "Review next opening"]} /></Field>
                    <div style={{ gridColumn: "1 / -1" }}><Field label="Archive Reason"><TextInput value={selectedSubmission.archiveReason} onChange={(event) => updateTracker(selectedSubmission.id, "archiveReason", event.target.value)} /></Field></div>
                    <div style={{ gridColumn: "1 / -1" }}><Field label="Archive Notes"><TextArea value={selectedSubmission.archiveNotes} onChange={(event) => updateTracker(selectedSubmission.id, "archiveNotes", event.target.value)} /></Field></div>
                  </div>
                  <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {isClosedStatus(selectedSubmission.status) || selectedSubmission.archived ? <Button primary onClick={() => restoreCandidate(selectedSubmission)}>Restore Candidate</Button> : null}
                    <Button danger onClick={() => archiveCandidate(selectedSubmission)}>Archive Candidate</Button>
                  </div>
                </Accordion>
              </div>}
            </Card>
          </div>
        ) : null}

        {activePage === "actions" ? (
          <div style={{ display: "grid", gap: 18 }}>
            <Card title="Action Center" subtitle="Daily work queues generated from tracker status, aging, due dates, and manager response needs." action={<Button primary onClick={bulkManagerFeedbackEmail} disabled={!actionQueues.feedbackRequired.length}>Copy Bulk Manager Feedback Email</Button>}>
              <div style={threeGrid}>
                <MiniStat label="Follow-Up Emails" value={actionQueues.followUps.length} tone={actionQueues.followUps.length ? "Medium" : "Low"} />
                <MiniStat label="Upcoming Interviews" value={actionQueues.upcomingInterviews.length} tone={actionQueues.upcomingInterviews.length ? "Interview" : "Low"} />
                <MiniStat label="Manager Feedback Required" value={actionQueues.feedbackRequired.length} tone={actionQueues.feedbackRequired.length ? "High" : "Low"} />
              </div>
            </Card>
            <QueueCard title="Follow-Up Emails" rows={actionQueues.followUps} empty="No candidate follow-ups due." actionLabel="Copy Follow-Up" onAction={markFollowedUp} />
            <QueueCard title="Upcoming Interviews" rows={actionQueues.upcomingInterviews} empty="No upcoming interviews." actionLabel="Copy Reminder" onAction={(item) => { const email = makeTemplateEmail(item, "interviewReminder", "Interview Reminder"); safeCopy(email.body); }} />
            <QueueCard title="Interviews Completed Today" rows={actionQueues.completedToday} empty="No completed interviews today." actionLabel="Copy Completed Follow-Up" onAction={(item) => { const email = makeTemplateEmail(item, "interviewCompletedFollowUp", "Interview Completed Follow-Up"); safeCopy(email.body); }} />
            <QueueCard title="Manager Feedback Required" rows={actionQueues.feedbackRequired} empty="No manager feedback queue." actionLabel="Copy Feedback Request" onAction={(item) => { const email = makeTemplateEmail(item, "managerFeedbackRequest", "Manager Feedback Request"); safeCopy(email.body); }} />
          </div>
        ) : null}

        {activePage === "metrics" ? (
          <div style={{ display: "grid", gap: 18 }}>
            <Card title="Metrics + Reporting" subtitle="MVP weekly report with leadership-friendly counts and risk visibility." action={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Button subtle onClick={exportHistoryCsv} disabled={!history.length}>Export History CSV</Button><Button primary onClick={generateWeeklyReport}>Generate Weekly Report</Button></div>}>
              <div style={{ display: "grid", gap: 14, gridTemplateColumns: isNarrow ? "1fr" : isMedium ? "repeat(3, minmax(0, 1fr))" : "repeat(6, minmax(0, 1fr))" }}>
                <MiniStat label="Submitted" value={metrics.total} />
                <MiniStat label="Awaiting" value={metrics.awaiting} tone="Medium" />
                <MiniStat label="Interview" value={metrics.interview} tone={metrics.interview ? "Interview" : "Low"} />
                <MiniStat label="Placed" value={metrics.placed} tone="Low" />
                <MiniStat label="Rejected" value={metrics.rejected} tone={metrics.rejected ? "High" : "Low"} />
                <MiniStat label="High Risk" value={metrics.highRisk} tone={metrics.highRisk ? "High" : "Low"} />
              </div>
            </Card>
            <Card title="Source Breakdown" subtitle="Shows where candidates are coming from when leadership asks for source visibility.">
              {!sourceMetrics.length ? <EmptyState>No candidate source data yet.</EmptyState> : <div style={{ display: "grid", gap: 12, gridTemplateColumns: isNarrow ? "1fr" : "repeat(3, minmax(0, 1fr))" }}>{sourceMetrics.map((item) => <MiniStat key={item.source} label={item.source} value={item.count} />)}</div>}
            </Card>
            <Card title="Weekly Report Output">{weeklyReport ? <EmailDocument title="Weekly Report" subject={weeklySubject} body={weeklyReport} /> : <EmptyState>Click Generate Weekly Report.</EmptyState>}</Card>
          </div>
        ) : null}

        {activePage === "settings" ? (
          <div style={{ display: "grid", gap: 18, gridTemplateColumns: isMedium ? "1fr" : "260px 1fr", alignItems: "start" }}>
            <Card compact>
              <div style={{ display: "grid", gap: 8 }}>{[["general", "Workspace Setup"], ["sites", "Sites"], ["requisitions", "Requisitions"], ["roles", "Roles"], ["compensation", "Compensation"], ["options", "Core Options"], ["templates", "Templates"]].map(([key, label]) => <Button key={key} primary={activeSettingsTab === key} subtle={activeSettingsTab !== key} onClick={() => setActiveSettingsTab(key)} style={{ width: "100%", textAlign: "left" }}>{label}</Button>)}</div>
            </Card>
            <SettingsPanel activeSettingsTab={activeSettingsTab} settings={settings} setSettings={setSettings} updateSettings={updateSettings} activeRoles={activeRoles} activeSites={activeSites} exportFullBackup={exportFullBackup} importFullBackup={importFullBackup} />
          </div>
        ) : null}

        {copyNotice ? <div style={{ position: "fixed", right: 18, bottom: 18, zIndex: 20, background: THEME.primary, color: "#ffffff", borderRadius: 8, padding: "11px 14px", fontWeight: 800, boxShadow: "0 12px 30px rgba(16,24,40,0.22)" }}>{copyNotice}</div> : null}
        <footer style={{ marginTop: 24, textAlign: "center", color: THEME.muted, fontSize: 13 }}>(c) Central 54 Holdings LLC</footer>
      </div>
    </div>
  );
}

function HistoryList({ rows, to }) {
  const width = useWindowWidth();
  const tight = width < 760;
  if (!rows.length) return <EmptyState>No history yet.</EmptyState>;
  return <div style={{ display: "grid", gap: 12 }}>{rows.map((item) => <div key={item.id} style={{ border: `1px solid ${THEME.borderSoft}`, borderRadius: 8, padding: 14, background: "#ffffff" }}><div style={{ display: "flex", flexDirection: tight ? "column" : "row", justifyContent: "space-between", gap: 12 }}><div><strong>{item.subject}</strong><div style={{ marginTop: 4, color: THEME.muted }}>{item.type} | {new Date(item.timestamp).toLocaleString()}</div>{item.candidate || item.facility ? <div style={{ marginTop: 4, color: THEME.muted }}>{[item.candidate, item.facility].filter(Boolean).join(" | ")}</div> : null}</div><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Button subtle onClick={() => safeCopy(item.body)} disabled={!item.body}>Copy</Button>{to && (item.subject || item.body) ? <a href={mailtoLink(to, item.subject, item.body)} style={{ textDecoration: "none", flex: tight ? "1 1 140px" : "0 0 auto" }}><Button primary style={{ width: "100%" }}>Open Draft</Button></a> : null}</div></div><pre style={{ margin: "12px 0 0", whiteSpace: "pre-wrap", fontFamily: "Inter, Arial, sans-serif", lineHeight: 1.6, background: THEME.panelAlt, border: `1px solid ${THEME.borderSoft}`, borderRadius: 8, padding: 12 }}>{item.body || "No body saved."}</pre></div>)}</div>;
}

function QueueCard({ title, rows, empty, actionLabel, onAction }) {
  const width = useWindowWidth();
  const tight = width < 900;
  return (
    <Card title={title} compact>
      {!rows.length ? <EmptyState>{empty}</EmptyState> : <div style={{ display: "grid", gap: 10 }}>{rows.map((item) => <div key={item.id} style={{ display: "grid", gridTemplateColumns: tight ? "1fr" : "1.2fr 1fr 1fr auto", gap: 12, alignItems: "center", border: `1px solid ${THEME.borderSoft}`, borderRadius: 8, padding: 12, background: "#ffffff" }}><div><strong>{item.candidate}</strong><div style={{ marginTop: 4, color: THEME.muted }}>{item.position}</div></div><div>{item.site}</div><div><Badge tone={riskFor(item)}>{riskFor(item)}</Badge> <span style={{ marginLeft: 8, color: THEME.muted }}>{daysBetween(item.submissionDate)}d</span></div><Button primary onClick={() => onAction(item)} style={tight ? { width: "100%" } : null}>{actionLabel}</Button></div>)}</div>}
    </Card>
  );
}

function SettingsPanel({ activeSettingsTab, settings, setSettings, updateSettings, activeRoles, activeSites, exportFullBackup, importFullBackup }) {
  const width = useWindowWidth();
  const fieldGrid = { display: "grid", gap: 14, gridTemplateColumns: width < 900 ? "1fr" : "repeat(2, minmax(0, 1fr))" };

  function updateArrayRecord(collection, id, key, value) {
    setSettings((prev) => ({ ...prev, [collection]: prev[collection].map((item) => item.id === id ? { ...item, [key]: value } : item) }));
  }

  function addSite() {
    setSettings((prev) => ({ ...prev, sites: [...prev.sites, { id: makeId("site"), siteName: "", siteType: "", location: "", hiringManagerName: "", hiringManagerEmail: "", adminContactName: "", adminContactEmail: "", status: "Active", notes: "" }] }));
  }

  function addRequisition() {
    setSettings((prev) => ({ ...prev, requisitions: [...(prev.requisitions || []), { id: makeId("req"), reqNumber: "", positionTitle: "", siteName: "", employmentType: "FT", shiftPreference: "", fte: "", status: "Active", notes: "" }] }));
  }

  function addRole() {
    setSettings((prev) => ({ ...prev, roles: [...prev.roles, { id: makeId("role"), positionTitle: "", roleCategory: "Other", requiresLicense: false, requiresCpr: false, requiresFte: false, requiresShift: false, requiresWorkExpectations: true, status: "Active" }] }));
  }

  function addCompRule() {
    setSettings((prev) => ({ ...prev, compensationStructure: { ...prev.compensationStructure, rules: [...prev.compensationStructure.rules, { id: makeId("comp"), positionTitle: "", scopeType: "Site Type", scopeValue: "", compensationType: "Hourly", basisType: "Years-based", experienceTier: "0-2", baseAmount: "", shiftDifferentialNight: "", shiftDifferentialWeekend: "", shiftDifferentialEvening: "", customNotes: "" }] } }));
  }

  function removeRecord(collection, id) {
    if (!window.confirm("Delete this settings record?")) return;
    setSettings((prev) => ({ ...prev, [collection]: prev[collection].filter((item) => item.id !== id) }));
  }

  function removeCompRule(id) {
    if (!window.confirm("Delete this compensation rule?")) return;
    setSettings((prev) => ({ ...prev, compensationStructure: { ...prev.compensationStructure, rules: prev.compensationStructure.rules.filter((item) => item.id !== id) } }));
  }

  function exportSettingsJson() {
    downloadTextFile("welcomeflow-settings.json", JSON.stringify(settings, null, 2), "application/json");
  }

  function importSettingsJson(text) {
    try {
      setSettings(mergeDefaults(DEFAULT_SETTINGS, JSON.parse(text)));
      window.dispatchEvent(new CustomEvent("welcomeflow-copy", { detail: "Settings imported" }));
    } catch {
      window.alert("Settings import failed. Please use a valid WelcomeFlow JSON file.");
    }
  }

  function importSitesCsv(text) {
    const rows = parseCsv(text).map((row) => ({ id: makeId("site"), siteName: row.siteName || row["Site Name"] || "", siteType: row.siteType || row["Site Type"] || "", location: row.location || row.Location || "", status: row.status || "Active", notes: row.notes || "" })).filter((row) => row.siteName);
    if (rows.length) setSettings((prev) => ({ ...prev, sites: [...prev.sites, ...rows] }));
  }

  function importRolesCsv(text) {
    const rows = parseCsv(text).map((row) => ({ id: makeId("role"), positionTitle: row.positionTitle || row["Position Title"] || "", roleCategory: row.roleCategory || row["Role Category"] || "Other", requiresLicense: String(row.requiresLicense || "").toLowerCase() === "true", requiresCpr: String(row.requiresCpr || "").toLowerCase() === "true", requiresFte: String(row.requiresFte ?? "true").toLowerCase() !== "false", requiresShift: String(row.requiresShift ?? "true").toLowerCase() !== "false", requiresWorkExpectations: String(row.requiresWorkExpectations ?? "true").toLowerCase() !== "false", status: row.status || "Active" })).filter((row) => row.positionTitle);
    if (rows.length) setSettings((prev) => ({ ...prev, roles: [...prev.roles, ...rows] }));
  }

  function importCompCsv(text) {
    const rows = parseCsv(text).map((row) => ({ id: makeId("comp"), positionTitle: row.positionTitle || row["Position Title"] || "", scopeType: row.scopeType || "Site Type", scopeValue: row.scopeValue || "", compensationType: row.compensationType || "Hourly", basisType: row.basisType || "Years-based", experienceTier: row.experienceTier || "0-2", baseAmount: row.baseAmount || "", shiftDifferentialNight: row.shiftDifferentialNight || "", shiftDifferentialWeekend: row.shiftDifferentialWeekend || "", shiftDifferentialEvening: row.shiftDifferentialEvening || "", customNotes: row.customNotes || "" })).filter((row) => row.positionTitle);
    if (rows.length) setSettings((prev) => ({ ...prev, compensationStructure: { ...prev.compensationStructure, rules: [...prev.compensationStructure.rules, ...rows] } }));
  }

  if (activeSettingsTab === "general") {
    return <Card title="Workspace Setup" subtitle="Personalizes generated emails, reports, and signatures." action={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Button subtle onClick={exportSettingsJson}>Export Settings</Button><FileButton accept="application/json,.json" onText={importSettingsJson}>Import Settings</FileButton><Button subtle onClick={exportFullBackup}>Export Full Backup</Button><FileButton accept="application/json,.json" onText={importFullBackup}>Import Full Backup</FileButton><Button danger onClick={() => { if (window.confirm("Reset settings to the built-in defaults?")) setSettings(DEFAULT_SETTINGS); }}>Reset Defaults</Button></div>}><div style={fieldGrid}>{Object.entries(settings.general).map(([key, value]) => <Field key={key} label={labelFromKey(key)}><TextInput value={value} onChange={(event) => updateSettings(["general", key], event.target.value)} /></Field>)}</div></Card>;
  }

  if (activeSettingsTab === "sites") {
    return <Card title="Sites" subtitle="Locations and site types feed compensation matching and tracker labels." action={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><FileButton accept=".csv,text/csv" onText={importSitesCsv}>Import Sites CSV</FileButton><Button primary onClick={addSite}>Add Site</Button></div>}><div style={{ display: "grid", gap: 14 }}>{settings.sites.map((site) => <div key={site.id} style={{ border: `1px solid ${THEME.borderSoft}`, borderRadius: 8, padding: 14, background: "#ffffff" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12, alignItems: "center" }}><strong>Site Record</strong><Button danger onClick={() => removeRecord("sites", site.id)}>Delete</Button></div><div style={fieldGrid}><Field label="Site Name"><TextInput value={site.siteName} onChange={(event) => updateArrayRecord("sites", site.id, "siteName", event.target.value)} /></Field><Field label="Site Type"><TextInput value={site.siteType} onChange={(event) => updateArrayRecord("sites", site.id, "siteType", event.target.value)} /></Field><Field label="Location"><TextInput value={site.location} onChange={(event) => updateArrayRecord("sites", site.id, "location", event.target.value)} /></Field><Field label="Hiring Manager Name"><TextInput value={site.hiringManagerName} onChange={(event) => updateArrayRecord("sites", site.id, "hiringManagerName", event.target.value)} /></Field><Field label="Hiring Manager Email"><TextInput value={site.hiringManagerEmail} onChange={(event) => updateArrayRecord("sites", site.id, "hiringManagerEmail", event.target.value)} /></Field><Field label="Administrative Contact Name"><TextInput value={site.adminContactName} onChange={(event) => updateArrayRecord("sites", site.id, "adminContactName", event.target.value)} /></Field><Field label="Administrative Contact Email"><TextInput value={site.adminContactEmail} onChange={(event) => updateArrayRecord("sites", site.id, "adminContactEmail", event.target.value)} /></Field><Field label="Status"><SelectInput value={site.status} onChange={(event) => updateArrayRecord("sites", site.id, "status", event.target.value)} options={["Active", "Inactive"]} /></Field><div style={{ gridColumn: "1 / -1" }}><Field label="Notes"><TextArea value={site.notes} onChange={(event) => updateArrayRecord("sites", site.id, "notes", event.target.value)} minHeight={72} /></Field></div></div></div>)}</div></Card>;
  }

  if (activeSettingsTab === "requisitions") {
    const statusOptions = settings.options.requisitionStatusOptions || REQUISITION_STATUS_OPTIONS;
    return <div style={{ display: "grid", gap: 16 }}><Card title="Requisition Status Options"><TagListEditor label="Req Statuses" values={statusOptions} onChange={(value) => updateSettings(["options", "requisitionStatusOptions"], value)} /></Card><Card title="Requisitions" subtitle="Only Active requisitions appear in Candidate Intake. Recruiters can still manually type a req number when needed." action={<Button primary onClick={addRequisition}>Add Requisition</Button>}><div style={{ display: "grid", gap: 14 }}>{(settings.requisitions || []).map((req) => <div key={req.id} style={{ border: `1px solid ${THEME.borderSoft}`, borderRadius: 8, padding: 14, background: "#ffffff" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12, alignItems: "center" }}><strong>Requisition Record</strong><Button danger onClick={() => removeRecord("requisitions", req.id)}>Delete</Button></div><div style={fieldGrid}><Field label="Req Number"><TextInput value={req.reqNumber} onChange={(event) => updateArrayRecord("requisitions", req.id, "reqNumber", event.target.value)} /></Field><Field label="Position"><SelectInput value={req.positionTitle} onChange={(event) => updateArrayRecord("requisitions", req.id, "positionTitle", event.target.value)} options={activeRoles.map((role) => role.positionTitle).filter(Boolean)} /></Field><Field label="Site / Facility"><SelectInput value={req.siteName} onChange={(event) => updateArrayRecord("requisitions", req.id, "siteName", event.target.value)} options={activeSites.map((site) => site.siteName).filter(Boolean)} /></Field><Field label="Employment Type"><SelectInput value={req.employmentType} onChange={(event) => updateArrayRecord("requisitions", req.id, "employmentType", event.target.value)} options={settings.options.employmentTypes} /></Field><Field label="Shift"><SelectInput value={req.shiftPreference} onChange={(event) => updateArrayRecord("requisitions", req.id, "shiftPreference", event.target.value)} options={settings.options.shiftOptions} /></Field><Field label="FTE"><SelectInput value={req.fte} onChange={(event) => updateArrayRecord("requisitions", req.id, "fte", event.target.value)} options={FTE_OPTIONS} /></Field><Field label="Status"><SelectInput value={req.status} onChange={(event) => updateArrayRecord("requisitions", req.id, "status", event.target.value)} options={statusOptions} /></Field><div style={{ gridColumn: "1 / -1" }}><Field label="Notes"><TextArea value={req.notes} onChange={(event) => updateArrayRecord("requisitions", req.id, "notes", event.target.value)} minHeight={70} /></Field></div></div></div>)}</div></Card></div>;
  }

  if (activeSettingsTab === "roles") {
    return <div style={{ display: "grid", gap: 16 }}><Card title="Role Category Options"><TagListEditor label="Role Categories" values={settings.options.roleTypes} onChange={(value) => updateSettings(["options", "roleTypes"], value)} /></Card><Card title="Roles" subtitle="Defines dropdowns and healthcare-specific requirements." action={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><FileButton accept=".csv,text/csv" onText={importRolesCsv}>Import Roles CSV</FileButton><Button primary onClick={addRole}>Add Role</Button></div>}><div style={{ display: "grid", gap: 14 }}>{settings.roles.map((role) => <div key={role.id} style={{ border: `1px solid ${THEME.borderSoft}`, borderRadius: 8, padding: 14, background: "#ffffff" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12, alignItems: "center" }}><strong>Role Record</strong><Button danger onClick={() => removeRecord("roles", role.id)}>Delete</Button></div><div style={fieldGrid}><Field label="Position Title"><TextInput value={role.positionTitle} onChange={(event) => updateArrayRecord("roles", role.id, "positionTitle", event.target.value)} /></Field><Field label="Role Category"><SelectInput value={role.roleCategory} onChange={(event) => updateArrayRecord("roles", role.id, "roleCategory", event.target.value)} options={settings.options.roleTypes} /></Field><ToggleField label="Requires License" checked={role.requiresLicense} onChange={(value) => updateArrayRecord("roles", role.id, "requiresLicense", value)} /><ToggleField label="Requires CPR" checked={role.requiresCpr} onChange={(value) => updateArrayRecord("roles", role.id, "requiresCpr", value)} /><ToggleField label="Requires FTE" checked={role.requiresFte} onChange={(value) => updateArrayRecord("roles", role.id, "requiresFte", value)} /><ToggleField label="Requires Shift" checked={role.requiresShift} onChange={(value) => updateArrayRecord("roles", role.id, "requiresShift", value)} /><ToggleField label="Requires Work Expectations" checked={role.requiresWorkExpectations} onChange={(value) => updateArrayRecord("roles", role.id, "requiresWorkExpectations", value)} /><Field label="Status"><SelectInput value={role.status} onChange={(event) => updateArrayRecord("roles", role.id, "status", event.target.value)} options={["Active", "Inactive"]} /></Field></div></div>)}</div></Card></div>;
  }

  if (activeSettingsTab === "compensation") {
    const setRule = (id, key, value) => setSettings((prev) => ({ ...prev, compensationStructure: { ...prev.compensationStructure, rules: prev.compensationStructure.rules.map((item) => item.id === id ? { ...item, [key]: value } : item) } }));
    const siteTypeOptions = Array.from(new Set(activeSites.map((site) => site.siteType).filter(Boolean)));
    return <Card title="Compensation Structure" subtitle="Hourly or salary rules with years-based, flat, or custom matching." action={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><FileButton accept=".csv,text/csv" onText={importCompCsv}>Import Rates CSV</FileButton><Button primary onClick={addCompRule}>Add Rule</Button></div>}><div style={{ marginBottom: 14 }}><ToggleField label="Enable Compensation Structure" checked={settings.compensationStructure.enabled} onChange={(value) => updateSettings(["compensationStructure", "enabled"], value)} /></div><div style={{ display: "grid", gap: 14 }}>{settings.compensationStructure.rules.map((rule) => { const scopeOptions = rule.scopeType === "Site" ? activeSites.map((site) => site.siteName).filter(Boolean) : siteTypeOptions; return <div key={rule.id} style={{ border: `1px solid ${THEME.borderSoft}`, borderRadius: 8, padding: 14, background: "#ffffff" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12, alignItems: "center" }}><strong>Compensation Rule</strong><Button danger onClick={() => removeCompRule(rule.id)}>Delete</Button></div><div style={fieldGrid}><Field label="Position Title"><SelectInput value={rule.positionTitle} onChange={(event) => setRule(rule.id, "positionTitle", event.target.value)} options={activeRoles.map((role) => role.positionTitle).filter(Boolean)} /></Field><Field label="Scope Type"><SelectInput value={rule.scopeType} onChange={(event) => { setRule(rule.id, "scopeType", event.target.value); setRule(rule.id, "scopeValue", ""); }} options={["Site Type", "Site"]} /></Field><Field label="Scope Value">{scopeOptions.length ? <SelectInput value={rule.scopeValue} onChange={(event) => setRule(rule.id, "scopeValue", event.target.value)} options={scopeOptions} /> : <TextInput value={rule.scopeValue} onChange={(event) => setRule(rule.id, "scopeValue", event.target.value)} />}</Field><Field label="Compensation Type"><SelectInput value={rule.compensationType} onChange={(event) => setRule(rule.id, "compensationType", event.target.value)} options={["Hourly", "Salary"]} /></Field><Field label="Basis Type"><SelectInput value={rule.basisType} onChange={(event) => setRule(rule.id, "basisType", event.target.value)} options={["Years-based", "Flat", "Custom"]} /></Field><Field label="Experience Tier"><SelectInput value={rule.experienceTier} onChange={(event) => setRule(rule.id, "experienceTier", event.target.value)} options={["0-2", "3-5", "6-10", "11-15", "16+"]} /></Field>{["baseAmount", "shiftDifferentialNight", "shiftDifferentialWeekend", "shiftDifferentialEvening"].map((key) => <Field key={key} label={labelFromKey(key)}><TextInput value={rule[key]} onChange={(event) => setRule(rule.id, key, event.target.value)} /></Field>)}</div></div>; })}</div></Card>;
  }

  if (activeSettingsTab === "options") {
    return <Card title="Core Options" subtitle="Dropdown values used across intake, tracker, and templates."><div style={fieldGrid}><TagListEditor label="Shift Preferences" values={settings.options.shiftOptions} onChange={(value) => updateSettings(["options", "shiftOptions"], value)} /><TagListEditor label="Work Types" values={settings.options.workTypes} onChange={(value) => updateSettings(["options", "workTypes"], value)} /><TagListEditor label="Start Date Options" values={settings.options.startAvailabilityOptions} onChange={(value) => updateSettings(["options", "startAvailabilityOptions"], value)} /><TagListEditor label="Employment Types" values={settings.options.employmentTypes} onChange={(value) => updateSettings(["options", "employmentTypes"], value)} /><TagListEditor label="Candidate Sources" values={settings.options.candidateSourceOptions || SOURCE_OPTIONS} onChange={(value) => updateSettings(["options", "candidateSourceOptions"], value)} /><TagListEditor label="Requisition Statuses" values={settings.options.requisitionStatusOptions || REQUISITION_STATUS_OPTIONS} onChange={(value) => updateSettings(["options", "requisitionStatusOptions"], value)} /><TagListEditor label="Education Levels" values={settings.options.educationLevels} onChange={(value) => updateSettings(["options", "educationLevels"], value)} /><TagListEditor label="License Status Options" values={settings.options.licenseStatusOptions} onChange={(value) => updateSettings(["options", "licenseStatusOptions"], value)} /><TagListEditor label="CPR Status Options" values={settings.options.cprStatusOptions} onChange={(value) => updateSettings(["options", "cprStatusOptions"], value)} /><TagListEditor label="OT Requirement Options" values={settings.options.workExpectationOptions.ot} onChange={(value) => updateSettings(["options", "workExpectationOptions", "ot"], value)} /><TagListEditor label="Weekend Requirement Options" values={settings.options.workExpectationOptions.weekend} onChange={(value) => updateSettings(["options", "workExpectationOptions", "weekend"], value)} /><TagListEditor label="On-Call Requirement Options" values={settings.options.workExpectationOptions.onCall} onChange={(value) => updateSettings(["options", "workExpectationOptions", "onCall"], value)} /></div></Card>;
  }

  const templateDefs = [
    ["hiringManager", "Hiring Manager Submission Email"],
    ["candidateConfirmation", "Candidate Confirmation Email"],
    ["candidate48HourFollowUp", "Candidate 48-Hour Follow-Up Email"],
    ["interviewReminder", "Interview Reminder Email"],
    ["interviewCompletedFollowUp", "Interview Completed Follow-Up Email"],
    ["managerFeedbackRequest", "Manager Feedback Request Email"],
    ["weeklyReport", "Weekly Report Email"],
    ["atsUpdate", "ATS Update Block"],
  ];

  return <Card title="Templates" subtitle="Current email wording stays default. Turn on custom templates only when you want overrides. Tokens: {candidate_name}, {position}, {facility}, {experience}, {start_date}, {interview_availability}, {recruiter_name}, {status}, {next_action}."><div style={{ display: "grid", gap: 12 }}>{templateDefs.map(([key, title]) => {
    const template = settings.templates[key] || DEFAULT_SETTINGS.templates[key];
    const previewValues = tokenMap(DEMO_FORM, settings, { status: "Submitted", nextAction: "Awaiting manager review", submissionDate: todayIso(), totalSubmitted: 4, active: 3, awaiting: 2, interview: 1, placed: 1, rejected: 0, highRisk: 1, finalComp: "$42.25/hr" });
    const previewSubject = applyTokens(template?.subject || title, previewValues);
    const previewBody = applyTokens(template?.body || "Default generator will be used when this custom template is off or blank.", previewValues);
    return <Accordion key={key} title={title}><div style={{ display: "grid", gap: 12 }}><ToggleField label="Use Custom Template" checked={template?.useCustom} onChange={(value) => updateSettings(["templates", key, "useCustom"], value)} /><Field label="Subject"><TextInput value={template?.subject} onChange={(event) => updateSettings(["templates", key, "subject"], event.target.value)} /></Field><Field label="Body"><TextArea value={template?.body} onChange={(event) => updateSettings(["templates", key, "body"], event.target.value)} minHeight={160} /></Field><div style={{ border: `1px solid ${THEME.borderSoft}`, borderRadius: 8, padding: 12, background: THEME.panelAlt }}><strong>Preview</strong><div style={{ marginTop: 8, color: THEME.muted }}>Subject: {previewSubject}</div><pre style={{ margin: "10px 0 0", whiteSpace: "pre-wrap", fontFamily: "Inter, Arial, sans-serif", lineHeight: 1.55 }}>{previewBody}</pre></div></div></Accordion>;
  })}</div></Card>;
}
