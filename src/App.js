import React, { useEffect, useMemo, useRef, useState } from "react";

const NL = String.fromCharCode(10);

const STORAGE_KEY = "welcomeflow-final-settings-v1";
const RECENT_KEY = "welcomeflow-final-recent-v1";
const SUBMISSIONS_KEY = "welcomeflow-final-submissions-v1";

const BRAND = {
  appName: "WelcomeFlow: Recruiting Assistant",
  tagline: "A cleaner recruiting workflow, built to move faster.",
  footer: "© Central 54 Holdings LLC",
};

const THEMES = {
  corporate: {
    name: "Corporate Premium",
    pageBg: "linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)",
    cardBg: "rgba(255,255,255,0.97)",
    cardBorder: "#e2e8f0",
    text: "#0f172a",
    muted: "#64748b",
    inputBorder: "#d7deea",
    sidebarBg: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
    primary: "#0f172a",
    secondary: "#1e3a8a",
    accent: "#2563eb",
    badgeBlueBg: "#dbeafe",
    badgeBlueText: "#1d4ed8",
    badgeGreenBg: "#d1fae5",
    badgeGreenText: "#047857",
    badgeSlateBg: "#f1f5f9",
    badgeSlateText: "#475569",
    badgeGoldBg: "#fef3c7",
    badgeGoldText: "#92400e",
  },
  dark: {
    name: "Dark Premium",
    pageBg: "linear-gradient(180deg, #020617 0%, #0f172a 100%)",
    cardBg: "rgba(15,23,42,0.96)",
    cardBorder: "#334155",
    text: "#f8fafc",
    muted: "#cbd5e1",
    inputBorder: "#475569",
    sidebarBg: "linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(2,6,23,0.98) 100%)",
    primary: "#020617",
    secondary: "#2563eb",
    accent: "#38bdf8",
    badgeBlueBg: "#1e3a8a",
    badgeBlueText: "#dbeafe",
    badgeGreenBg: "#064e3b",
    badgeGreenText: "#d1fae5",
    badgeSlateBg: "#334155",
    badgeSlateText: "#e2e8f0",
    badgeGoldBg: "#78350f",
    badgeGoldText: "#fde68a",
  },
};

const SUPPORTED_IMPORTS = ["PDF", "DOCX", "TXT", "XLSX", "CSV"];
const ROLE_TYPES = ["Healthcare", "Other"];
const WORK_TYPES = ["On-site", "Remote", "Hybrid"];
const SHIFT_OPTIONS = ["Day", "Night", "Evening", "Day or Night", "Evening or Night", "Any Shift"];
const START_OPTIONS = ["Immediate", "2–4 weeks", "4–6 weeks", "3 months", "6 months"];
const COMP_TYPES = ["Hourly", "Salary"];
const COMP_BASIS = ["Years-based", "Flat", "Custom"];
const FTE_OPTIONS = [
  { label: "40 hrs/week (1.0)", value: "1.0" },
  { label: "36 hrs/week (0.9)", value: "0.9" },
  { label: "32 hrs/week (0.8)", value: "0.8" },
  { label: "24 hrs/week (0.6)", value: "0.6" },
  { label: "20 hrs/week (0.5)", value: "0.5" },
  { label: "16 hrs/week (0.4)", value: "0.4" },
  { label: "PRN", value: "PRN" },
];

const DEFAULT_SETTINGS = {
  general: {
    workspaceName: "",
    companyName: "",
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
  },
  sites: [
    { id: "site-1", siteName: "Demo Facility", siteType: "24-hour", location: "Douglasville, GA", status: "Active", notes: "" },
  ],
  roles: [
    { id: "role-1", positionTitle: "Registered Nurse", roleCategory: "Healthcare", requiresLicense: true, requiresCpr: true, requiresFte: true, requiresShift: true, requiresWorkExpectations: true, status: "Active" },
    { id: "role-2", positionTitle: "Administrative Assistant", roleCategory: "Other", requiresLicense: false, requiresCpr: false, requiresFte: false, requiresShift: false, requiresWorkExpectations: true, status: "Active" },
  ],
  compensationStructure: {
    enabled: true,
    rules: [
      { id: "comp-1", positionTitle: "Registered Nurse", scopeType: "Site Type", scopeValue: "24-hour", compensationType: "Hourly", basisType: "Years-based", experienceTier: "3–5", baseAmount: "$42.25/hr", shiftDifferentialNight: "$2.00/hr", shiftDifferentialWeekend: "$1.50/hr", shiftDifferentialEvening: "$1.00/hr", customNotes: "" },
    ],
  },
  templates: {
    introLine: "Please review the candidate details below.",
    closingLine: "The candidate is aware of the role expectations and is prepared to move forward.",
    followUpLine: "Please review and advise next steps within 24–48 hours.",
    includeSubmissionDate: true,
    includeEducation: true,
    includeCredentials: true,
    candidateEmailIntro: "Thank you for taking the time to speak with me today.",
    candidateEmailNextStep1: "Your information is currently being reviewed by the hiring team.",
    candidateEmailNextStep2: "If selected, the facility may reach out directly regarding interview coordination.",
    candidateEmailNextStep3: "I will continue to monitor your submission and share updates as they become available.",
    candidateEmailTiming: "You can expect an update within 24–48 hours.",
    candidateEmailSupportLine: "If anything changes on your end, please feel free to reach out directly.",
  },
};

const DEFAULT_FORM = {
  fullName: "",
  phoneNumber: "",
  emailAddress: "",
  location: "",
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
  startAvailability: "2–4 weeks",
  startNotes: "Needs to give two-week notice",
  interviewAvailability: "Mon–Fri after 4 PM",
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
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
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

function todayString() {
  return new Date().toLocaleDateString("en-US");
}

function tierFromYears(value) {
  const years = Number(value || 0);
  if (years <= 2) return "0–2";
  if (years <= 5) return "3–5";
  if (years <= 10) return "6–10";
  if (years <= 15) return "11–15";
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

function badgeStyle(bg, color) {
  return { display: "inline-flex", alignItems: "center", padding: "7px 11px", borderRadius: 999, background: bg, color, fontSize: 12, fontWeight: 700 };
}

function safeCopy(text) {
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).catch(() => {});
}

function downloadTextFile(name, content, type) {
  const blob = new Blob([content], { type: type || "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function Button({ children, onClick, primary, style, type }) {
  return <button type={type || "button"} onClick={onClick} style={{ padding: "11px 16px", borderRadius: 12, border: primary ? "1px solid #0f172a" : "1px solid #d7deea", background: primary ? "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)" : "#ffffff", color: primary ? "#ffffff" : "#0f172a", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "Arial, sans-serif", ...style }}>{children}</button>;
}

function Field({ label, children, color }) {
  return <label style={{ display: "block" }}><div style={{ marginBottom: 6, fontSize: 11, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>{children}</label>;
}

function TextInput({ value, onChange, placeholder, type, readOnly, border }) {
  return <input value={value} onChange={onChange} placeholder={placeholder || ""} type={type || "text"} readOnly={readOnly} style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: `1px solid ${border}`, boxSizing: "border-box", background: readOnly ? "#f8fafc" : "#ffffff", outline: "none", fontSize: 13, fontFamily: "Arial, sans-serif" }} />;
}

function SelectInput({ value, onChange, options, placeholder, border }) {
  return <select value={value} onChange={onChange} style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: `1px solid ${border}`, boxSizing: "border-box", background: "#ffffff", outline: "none", fontSize: 13, fontFamily: "Arial, sans-serif" }}><option value="">{placeholder || "Select"}</option>{options.map((option) => { const key = typeof option === "string" ? option : option.value; const label = typeof option === "string" ? option : option.label; return <option key={key} value={key}>{label}</option>; })}</select>;
}

function TextArea({ value, onChange, border }) {
  return <textarea value={value} onChange={onChange} style={{ width: "100%", minHeight: 96, padding: "12px 14px", borderRadius: 12, border: `1px solid ${border}`, boxSizing: "border-box", resize: "vertical", background: "#ffffff", outline: "none", fontSize: 13, fontFamily: "Arial, sans-serif" }} />;
}

function Card({ title, subtitle, children, action, theme }) {
  return <section style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}`, borderRadius: 20, padding: 24, boxShadow: "0 10px 26px rgba(15,23,42,0.06)" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 20, alignItems: "flex-start" }}><div><h2 style={{ margin: 0, fontSize: 22, color: theme.text, fontWeight: 700 }}>{title}</h2>{subtitle ? <p style={{ margin: "8px 0 0 0", color: theme.muted, fontSize: 13, lineHeight: 1.6 }}>{subtitle}</p> : null}</div>{action || null}</div>{children}</section>;
}

function ToggleField({ label, checked, onChange, theme }) {
  return <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: `1px solid ${theme.cardBorder}`, borderRadius: 12, padding: 12, background: "#ffffff" }}><span style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /></label>;
}

function NavButton({ active, children, onClick }) {
  return <button type="button" onClick={onClick} style={{ width: "100%", textAlign: "left", padding: "12px 14px", borderRadius: 12, border: active ? "1px solid #1e3a8a" : "1px solid transparent", background: active ? "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)" : "transparent", color: active ? "#ffffff" : "#334155", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{children}</button>;
}

function TagListEditor({ label, values, onChange, theme }) {
  const [draft, setDraft] = useState("");
  function addValue() {
    const clean = draft.trim();
    if (!clean || values.includes(clean)) return;
    onChange([...values, clean]);
    setDraft("");
  }
  return <div style={{ border: `1px solid ${theme.cardBorder}`, borderRadius: 16, padding: 16, background: "#ffffff" }}><div style={{ marginBottom: 10, fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{label}</div><div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>{values.map((value) => <span key={value} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 9px", borderRadius: 999, background: "#eef2ff", fontSize: 12, border: "1px solid #dbe4f0" }}>{value}<button type="button" onClick={() => onChange(values.filter((item) => item !== value))} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#475569" }}>×</button></span>)}</div><div style={{ display: "flex", gap: 8 }}><TextInput value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Add option" border={theme.inputBorder} /><Button onClick={addValue}>Add</Button></div></div>;
}

function OutputBlock({ title, badge, value, theme }) {
  return <div><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, gap: 10, flexWrap: "wrap", alignItems: "center" }}><div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}><div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: theme.muted }}>{title}</div>{badge ? <span style={badgeStyle(theme.badgeBlueBg, theme.badgeBlueText)}>{badge}</span> : null}</div><Button onClick={() => safeCopy(value)}>Copy</Button></div><pre style={{ margin: 0, whiteSpace: "pre-wrap", background: "#ffffff", color: "#0f172a", border: `1px solid ${theme.cardBorder}`, borderRadius: 16, padding: 18, lineHeight: 1.75, fontFamily: "Arial, sans-serif", fontSize: 13 }}>{value}</pre></div>;
}

export default function App() {
  const [activePage, setActivePage] = useState("submission");
  const [activeSettingsTab, setActiveSettingsTab] = useState("general");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [form, setForm] = useState(DEMO_FORM);
  const [recentCandidates, setRecentCandidates] = useState([DEMO_FORM]);
  const [submissionHistory, setSubmissionHistory] = useState([]);
  const [output, setOutput] = useState(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [themeKey, setThemeKey] = useState("corporate");
  const [importMode, setImportMode] = useState("mixed");
  const importInputRef = useRef(null);

  useEffect(() => {
    setSettings(loadStoredValue(STORAGE_KEY, DEFAULT_SETTINGS));
    setRecentCandidates(loadStoredValue(RECENT_KEY, [DEMO_FORM]));
    setSubmissionHistory(loadStoredValue(SUBMISSIONS_KEY, []));
    setHasLoaded(true);
  }, []);

  useEffect(() => { if (hasLoaded) saveStoredValue(STORAGE_KEY, settings); }, [settings, hasLoaded]);
  useEffect(() => { if (hasLoaded) saveStoredValue(RECENT_KEY, recentCandidates); }, [recentCandidates, hasLoaded]);
  useEffect(() => { if (hasLoaded) saveStoredValue(SUBMISSIONS_KEY, submissionHistory); }, [submissionHistory, hasLoaded]);

  const theme = THEMES[themeKey] || THEMES.corporate;
  const activeRoles = useMemo(() => settings.roles.filter((role) => role.status === "Active"), [settings.roles]);
  const activeSites = useMemo(() => settings.sites.filter((site) => site.status === "Active"), [settings.sites]);
  const selectedRole = useMemo(() => activeRoles.find((role) => role.positionTitle === form.position) || null, [activeRoles, form.position]);
  const selectedSite = useMemo(() => activeSites.find((site) => site.siteName === form.siteName) || null, [activeSites, form.siteName]);
  const isHealthcare = (form.roleCategory || selectedRole?.roleCategory) === "Healthcare";

  const setupProgress = useMemo(() => {
    const checks = [Boolean(settings.general.companyName || settings.general.recruiterName), settings.sites.some((site) => site.siteName), settings.roles.some((role) => role.positionTitle), !settings.compensationStructure.enabled || settings.compensationStructure.rules.some((rule) => rule.positionTitle && rule.baseAmount), Boolean(settings.templates.introLine)];
    const complete = checks.filter(Boolean).length;
    return { complete, total: 5, percent: Math.round((complete / 5) * 100) };
  }, [settings]);

  const estimatedComp = useMemo(() => {
    if (!settings.compensationStructure.enabled || !form.position) return "";
    const tier = tierFromYears(form.yearsExperience);
    const match = settings.compensationStructure.rules.find((rule) => {
      const positionMatch = rule.positionTitle === form.position;
      const scopeMatch = rule.scopeType === "Site Type" ? rule.scopeValue === (selectedSite?.siteType || "") : rule.scopeValue === form.siteName;
      const basisMatch = rule.basisType === "Flat" || rule.basisType === "Custom" ? true : rule.experienceTier === tier;
      return positionMatch && scopeMatch && basisMatch;
    });
    if (!match) return "";
    const extras = [];
    if (form.shiftPreference === "Night" && match.shiftDifferentialNight) extras.push(`Night: ${match.shiftDifferentialNight}`);
    if (form.shiftPreference === "Evening" && match.shiftDifferentialEvening) extras.push(`Evening: ${match.shiftDifferentialEvening}`);
    if ((form.weekendRequirement === "Required" || form.weekendRequirement === "Rotating") && match.shiftDifferentialWeekend) extras.push(`Weekend: ${match.shiftDifferentialWeekend}`);
    return extras.length ? `${match.baseAmount} base | ${extras.join(" | ")}` : match.baseAmount;
  }, [settings.compensationStructure, form.position, form.yearsExperience, form.siteName, form.shiftPreference, form.weekendRequirement, selectedSite]);

  function updateForm(key, value) { setForm((prev) => ({ ...prev, [key]: value })); }
  function updateGeneral(key, value) { setSettings((prev) => ({ ...prev, general: { ...prev.general, [key]: value } })); }
  function updateOptions(key, value) { setSettings((prev) => ({ ...prev, options: { ...prev.options, [key]: value } })); }
  function updateTemplates(key, value) { setSettings((prev) => ({ ...prev, templates: { ...prev.templates, [key]: value } })); }
  function updateSite(id, key, value) { setSettings((prev) => ({ ...prev, sites: prev.sites.map((site) => site.id === id ? { ...site, [key]: value } : site) })); }
  function updateRole(id, key, value) { setSettings((prev) => ({ ...prev, roles: prev.roles.map((role) => role.id === id ? { ...role, [key]: value } : role) })); }
  function updateCompRule(id, key, value) { setSettings((prev) => ({ ...prev, compensationStructure: { ...prev.compensationStructure, rules: prev.compensationStructure.rules.map((rule) => rule.id === id ? { ...rule, [key]: value } : rule) } })); }

  function addSite() { setSettings((prev) => ({ ...prev, sites: [...prev.sites, { id: makeId("site"), siteName: "", siteType: "", location: "", status: "Active", notes: "" }] })); }
  function addRole() { setSettings((prev) => ({ ...prev, roles: [...prev.roles, { id: makeId("role"), positionTitle: "", roleCategory: "Other", requiresLicense: false, requiresCpr: false, requiresFte: false, requiresShift: false, requiresWorkExpectations: true, status: "Active" }] })); }
  function addCompRule() { setSettings((prev) => ({ ...prev, compensationStructure: { ...prev.compensationStructure, rules: [...prev.compensationStructure.rules, { id: makeId("comp"), positionTitle: "", scopeType: "Site Type", scopeValue: "", compensationType: "Hourly", basisType: "Years-based", experienceTier: "0–2", baseAmount: "", shiftDifferentialNight: "", shiftDifferentialWeekend: "", shiftDifferentialEvening: "", customNotes: "" }] } })); }
  function removeSite(id) { setSettings((prev) => ({ ...prev, sites: prev.sites.filter((site) => site.id !== id) })); }
  function removeRole(id) { setSettings((prev) => ({ ...prev, roles: prev.roles.filter((role) => role.id !== id) })); }
  function removeCompRule(id) { setSettings((prev) => ({ ...prev, compensationStructure: { ...prev.compensationStructure, rules: prev.compensationStructure.rules.filter((rule) => rule.id !== id) } })); }

  function openImport(mode) { setImportMode(mode); importInputRef.current?.click(); }
  function handleImport(files) {
    const incoming = Array.from(files || []);
    const unsupported = incoming.find((file) => !SUPPORTED_IMPORTS.includes((file.name.split(".").pop() || "").toUpperCase()));
    if (unsupported) { alert("Unsupported file format. Supported formats: PDF, Word, Text, Excel, and CSV."); return; }
    alert(`${incoming.length} file(s) accepted for ${importMode}. Parsing is a future build layer.`);
  }

  function buildCredentials() {
    if (!isHealthcare) return "";
    const values = [];
    if (form.licenseStatus) values.push(`License: ${form.licenseStatus}`);
    if (form.cprStatus) values.push(`CPR: ${form.cprStatus}`);
    if (form.licensedYear) values.push(`Licensed Since: ${form.licensedYear}`);
    return values.join(" | ");
  }

  function buildHiringManagerEmail(finalComp) {
    const facilityName = form.siteName || settings.general.companyName || "Hiring Team";
    const candidateName = form.fullName || "The candidate";
    const positionName = form.position || "N/A";
    const siteLine = `${facilityName} | ${form.location || "N/A"}`;
    const educationLine = settings.templates.includeEducation ? buildEducation(form) : "";
    const credentialsLine = settings.templates.includeCredentials ? buildCredentials() : "";
    return [`Hello ${facilityName},`, "", settings.templates.introLine || "Please review the candidate details below.", "", settings.templates.includeSubmissionDate ? `Submission Date: ${todayString()}` : "", "", "Candidate Summary", `• ${candidateName} | ${positionName} | ${fteLabel(form.fte)} | ${form.shiftPreference || "N/A"}`, `• ${form.phoneNumber || "N/A"} | ${form.emailAddress || "N/A"}`, `• ${siteLine}`, `• Compensation: ${form.compensationType || "Hourly"} | ${finalComp}`, "", "Experience Summary", `• ${candidateName} brings ${form.yearsExperience || "N/A"} years of experience as a ${positionName}. ${form.experienceNotes || ""}`.trim(), educationLine && educationLine !== "N/A" ? `• Education: ${educationLine}` : "", credentialsLine ? `• ${credentialsLine}` : "", "", "Availability", `• Available to start ${form.startAvailability || "N/A"}${form.startNotes ? `, with the following note: ${form.startNotes}` : ""}. Interview availability is ${form.interviewAvailability || "N/A"}.`, "", "Work Expectations", `• The candidate has confirmed a schedule of ${form.workSchedule || "N/A"}, with OT set to ${form.otRequirement || "N/A"}, weekend requirement set to ${form.weekendRequirement || "N/A"}, and on-call requirement set to ${form.onCallRequirement || "N/A"}.`, "", "Work Area", `• ${form.workArea || "N/A"}`, "", "Additional Notes", `${form.candidateNotes || ""} ${settings.templates.closingLine} ${settings.templates.followUpLine}`.trim(), "", settings.general.signOffName || settings.general.recruiterName || "", settings.general.signOffLine || ""].filter(Boolean).join(NL);
  }

  function buildAtsShort(finalComp) {
    return [`Submittal Date: ${todayString()}`, `Recruiter: ${settings.general.recruiterName || "N/A"}`, "", "Candidate Details", `• ${form.fullName || "N/A"} | ${form.position || "N/A"} | ${form.siteName || "N/A"}`, "", "Quick Snapshot", `• ${form.yearsExperience || "N/A"} yrs | ${finalComp}`, `• Start ${form.startAvailability || "N/A"} | Interview ${form.interviewAvailability || "N/A"}`, `• ${form.workType || "N/A"} | ${fteLabel(form.fte)} | ${form.shiftPreference || "N/A"}`, "", "Work Expectations", `• Schedule: ${form.workSchedule || "N/A"} | OT: ${form.otRequirement || "N/A"} | Weekend: ${form.weekendRequirement || "N/A"} | On-Call: ${form.onCallRequirement || "N/A"}`, "", "Work Area", `• ${form.workArea || "N/A"}`, "", "Status", "• Ready for submission", "", "Full details available in submission."].join(NL);
  }

  function buildCandidateEmail(finalComp) {
    const positionLine = `${form.position || "position"}${form.shiftPreference ? `, ${form.shiftPreference}` : ""}${form.employmentType ? `, ${form.employmentType}` : ""}`;
    return [`Hello ${form.fullName || "Candidate"},`, "", settings.templates.candidateEmailIntro, "", `Your profile has been submitted for the ${positionLine} position with ${form.siteName || "the facility"}.`, "", "Compensation Structure", `${form.compensationType || "Hourly"}: ${finalComp}`, "", "Next Steps", `• ${settings.templates.candidateEmailNextStep1}`, `• ${settings.templates.candidateEmailNextStep2}`, `• ${settings.templates.candidateEmailNextStep3}`, "", settings.templates.candidateEmailTiming, settings.templates.candidateEmailSupportLine, "", settings.general.signOffName || settings.general.recruiterName || "", settings.general.signOffLine || ""].filter(Boolean).join(NL);
  }

  function generateOutput() {
    const finalComp = form.compensationRequested || estimatedComp || "TBD";
    const generatedOutput = { submissionDate: todayString(), finalComp, hiringManagerEmail: buildHiringManagerEmail(finalComp), atsShort: buildAtsShort(finalComp), candidateEmail: buildCandidateEmail(finalComp) };
    setOutput(generatedOutput);
    setSubmissionHistory((prev) => [{ id: makeId("sub"), candidate: form.fullName || "Unnamed Candidate", position: form.position || "N/A", site: form.siteName || "N/A", date: generatedOutput.submissionDate, output: generatedOutput }, ...prev].slice(0, 25));
    setRecentCandidates((prev) => [form, ...prev.filter((item) => item.fullName !== form.fullName)].slice(0, 8));
  }

  function clearForm() { if (!window.confirm("Are you sure you want to clear all fields?")) return; setForm({ ...DEFAULT_FORM }); setOutput(null); }
  function importSettings(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { try { setSettings(JSON.parse(String(reader.result))); setOutput(null); alert("Settings imported"); } catch { alert("Import failed"); } };
    reader.readAsText(file);
  }

  function downloadTemplate(kind) {
    const templates = {
      locations: `siteName,siteType,location,status,notes${NL}Demo Facility,24-hour,Douglasville GA,Active,`,
      roles: `positionTitle,roleCategory,requiresLicense,requiresCpr,requiresFte,requiresShift,requiresWorkExpectations,status${NL}Registered Nurse,Healthcare,true,true,true,true,true,Active`,
      rateTables: `positionTitle,scopeType,scopeValue,compensationType,basisType,experienceTier,baseAmount,shiftDifferentialNight,shiftDifferentialWeekend,shiftDifferentialEvening,customNotes${NL}Registered Nurse,Site Type,24-hour,Hourly,Years-based,3–5,$42.25/hr,$2.00/hr,$1.50/hr,$1.00/hr,`,
      shifts: `shiftOption${NL}Day${NL}Night${NL}Evening${NL}Day or Night${NL}Evening or Night${NL}Any Shift`,
      customFields: `label,fieldType,required,options,appliesTo${NL}Special Note,text,false,,candidate`,
    };
    downloadTextFile(`${kind}-template.csv`, templates[kind] || "", "text/csv");
  }

  const pageStyle = { minHeight: "100vh", background: theme.pageBg, color: theme.text, fontFamily: "Arial, sans-serif", fontSize: 13 };
  const shellStyle = { maxWidth: 1320, margin: "0 auto", padding: 28 };
  const fieldGrid = { display: "grid", gap: 16, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" };
  const gridTwo = { display: "grid", gap: 24, gridTemplateColumns: "1.05fr 0.95fr", alignItems: "start" };

  return <div style={pageStyle}><div style={shellStyle}>
    <Card title={BRAND.appName} subtitle={BRAND.tagline} theme={theme} action={<div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}><Button primary={activePage === "submission"} onClick={() => setActivePage("submission")}>Submission</Button><Button primary={activePage === "submissions"} onClick={() => setActivePage("submissions")}>Submissions</Button><Button primary={activePage === "settings"} onClick={() => setActivePage("settings")}>Settings</Button></div>}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><span style={badgeStyle(theme.badgeBlueBg, theme.badgeBlueText)}>Workspace Ready</span><span style={badgeStyle(theme.badgeGreenBg, theme.badgeGreenText)}>{settings.compensationStructure.enabled ? "Compensation Active" : "Manual Compensation"}</span><span style={badgeStyle(theme.badgeSlateBg, theme.badgeSlateText)}>{activeRoles.length} Active Roles</span><span style={badgeStyle(theme.badgeGoldBg, theme.badgeGoldText)}>{activeSites.length} Active Sites</span></div><div style={{ minWidth: 180 }}><SelectInput value={themeKey} onChange={(event) => setThemeKey(event.target.value)} options={[{ label: "Corporate Premium", value: "corporate" }, { label: "Dark Premium", value: "dark" }]} border={theme.inputBorder} /></div></div>
    </Card>
    <div style={{ marginTop: 18, marginBottom: 24, background: theme.cardBg, border: `1px solid ${theme.cardBorder}`, borderRadius: 20, padding: 18 }}><div style={{ fontSize: 11, fontWeight: 700, color: theme.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>Setup Progress</div><div style={{ marginTop: 8, height: 10, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" }}><div style={{ width: `${setupProgress.percent}%`, height: "100%", background: `linear-gradient(135deg, ${theme.secondary} 0%, ${theme.accent} 100%)` }} /></div><div style={{ marginTop: 8, fontSize: 13, color: theme.muted }}>{setupProgress.complete} of {setupProgress.total} setup areas complete, {setupProgress.percent}% done</div></div>
    {activePage === "submission" ? <div style={gridTwo}><div style={{ display: "grid", gap: 24 }}><Card title="Candidate Intake" subtitle="Professional intake flow with work expectations and clean outputs." theme={theme} action={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Button onClick={() => setForm(DEMO_FORM)}>Load Demo</Button><Button onClick={clearForm}>Clear Form</Button></div>}><div style={fieldGrid}><Field label="Position" color={theme.muted}><SelectInput value={form.position} onChange={(event) => updateForm("position", event.target.value)} options={activeRoles.map((role) => role.positionTitle)} placeholder="Select role" border={theme.inputBorder} /></Field><Field label="Role Category" color={theme.muted}><SelectInput value={form.roleCategory || selectedRole?.roleCategory || ""} onChange={(event) => updateForm("roleCategory", event.target.value)} options={settings.options.roleTypes} placeholder="Healthcare or Other" border={theme.inputBorder} /></Field><Field label="Full Name" color={theme.muted}><TextInput value={form.fullName} onChange={(event) => updateForm("fullName", event.target.value)} border={theme.inputBorder} /></Field><Field label="Phone Number" color={theme.muted}><TextInput value={form.phoneNumber} onChange={(event) => updateForm("phoneNumber", event.target.value)} border={theme.inputBorder} /></Field><Field label="Email Address" color={theme.muted}><TextInput value={form.emailAddress} onChange={(event) => updateForm("emailAddress", event.target.value)} border={theme.inputBorder} /></Field><Field label="Location" color={theme.muted}><TextInput value={form.location} onChange={(event) => updateForm("location", event.target.value)} border={theme.inputBorder} /></Field><Field label="Site / Facility" color={theme.muted}><SelectInput value={form.siteName} onChange={(event) => updateForm("siteName", event.target.value)} options={activeSites.map((site) => site.siteName)} placeholder="Select site" border={theme.inputBorder} /></Field><Field label="Employment Type" color={theme.muted}><SelectInput value={form.employmentType} onChange={(event) => updateForm("employmentType", event.target.value)} options={settings.options.employmentTypes} border={theme.inputBorder} /></Field><Field label="Shift Preference" color={theme.muted}><SelectInput value={form.shiftPreference} onChange={(event) => updateForm("shiftPreference", event.target.value)} options={settings.options.shiftOptions} border={theme.inputBorder} /></Field><Field label="Work Type" color={theme.muted}><SelectInput value={form.workType} onChange={(event) => updateForm("workType", event.target.value)} options={settings.options.workTypes} border={theme.inputBorder} /></Field><Field label="FTE" color={theme.muted}><SelectInput value={form.fte} onChange={(event) => updateForm("fte", event.target.value)} options={FTE_OPTIONS} border={theme.inputBorder} /></Field><Field label="Years of Experience" color={theme.muted}><TextInput value={form.yearsExperience} onChange={(event) => updateForm("yearsExperience", event.target.value)} type="number" border={theme.inputBorder} /></Field><Field label="Education" color={theme.muted}><SelectInput value={form.educationLevel} onChange={(event) => updateForm("educationLevel", event.target.value)} options={settings.options.educationLevels} border={theme.inputBorder} /></Field><Field label="Compensation Requested" color={theme.muted}><TextInput value={form.compensationRequested} onChange={(event) => updateForm("compensationRequested", event.target.value)} placeholder="Optional override" border={theme.inputBorder} /></Field><Field label="Estimated Compensation" color={theme.muted}><TextInput value={estimatedComp} readOnly border={theme.inputBorder} /></Field><Field label="Start Date" color={theme.muted}><SelectInput value={form.startAvailability} onChange={(event) => updateForm("startAvailability", event.target.value)} options={settings.options.startAvailabilityOptions} border={theme.inputBorder} /></Field><Field label="Interview Availability" color={theme.muted}><TextInput value={form.interviewAvailability} onChange={(event) => updateForm("interviewAvailability", event.target.value)} border={theme.inputBorder} /></Field><div style={{ gridColumn: "1 / -1" }}><Field label="Start Date Notes" color={theme.muted}><TextArea value={form.startNotes} onChange={(event) => updateForm("startNotes", event.target.value)} border={theme.inputBorder} /></Field></div>{isHealthcare ? <Field label="License Status" color={theme.muted}><SelectInput value={form.licenseStatus} onChange={(event) => updateForm("licenseStatus", event.target.value)} options={settings.options.licenseStatusOptions} border={theme.inputBorder} /></Field> : null}{isHealthcare ? <Field label="CPR Status" color={theme.muted}><SelectInput value={form.cprStatus} onChange={(event) => updateForm("cprStatus", event.target.value)} options={settings.options.cprStatusOptions} border={theme.inputBorder} /></Field> : null}{isHealthcare ? <Field label="Licensed Year" color={theme.muted}><TextInput value={form.licensedYear} onChange={(event) => updateForm("licensedYear", event.target.value)} border={theme.inputBorder} /></Field> : null}<div style={{ gridColumn: "1 / -1" }}><Field label="Experience Notes" color={theme.muted}><TextArea value={form.experienceNotes} onChange={(event) => updateForm("experienceNotes", event.target.value)} border={theme.inputBorder} /></Field></div></div><div style={{ marginTop: 20 }}><h3 style={{ margin: 0, fontSize: 16, color: theme.text }}>Position-Based Work Expectations</h3><div style={{ ...fieldGrid, marginTop: 12 }}><Field label="Work Schedule" color={theme.muted}><TextInput value={form.workSchedule} onChange={(event) => updateForm("workSchedule", event.target.value)} border={theme.inputBorder} /></Field><Field label="Work Area" color={theme.muted}><TextInput value={form.workArea} onChange={(event) => updateForm("workArea", event.target.value)} border={theme.inputBorder} /></Field><Field label="OT Requirement" color={theme.muted}><SelectInput value={form.otRequirement} onChange={(event) => updateForm("otRequirement", event.target.value)} options={settings.options.workExpectationOptions.ot} border={theme.inputBorder} /></Field><Field label="Weekend Requirement" color={theme.muted}><SelectInput value={form.weekendRequirement} onChange={(event) => updateForm("weekendRequirement", event.target.value)} options={settings.options.workExpectationOptions.weekend} border={theme.inputBorder} /></Field><Field label="On-Call Requirement" color={theme.muted}><SelectInput value={form.onCallRequirement} onChange={(event) => updateForm("onCallRequirement", event.target.value)} options={settings.options.workExpectationOptions.onCall} border={theme.inputBorder} /></Field></div></div><div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(2, minmax(0, 1fr))", marginTop: 16 }}><ToggleField label="Schedule Confirmed" checked={form.scheduleConfirmed} onChange={(value) => updateForm("scheduleConfirmed", value)} theme={theme} /><ToggleField label="OT Confirmed" checked={form.otConfirmed} onChange={(value) => updateForm("otConfirmed", value)} theme={theme} /><ToggleField label="Weekend Confirmed" checked={form.weekendConfirmed} onChange={(value) => updateForm("weekendConfirmed", value)} theme={theme} /><ToggleField label="On-Call Confirmed" checked={form.onCallConfirmed} onChange={(value) => updateForm("onCallConfirmed", value)} theme={theme} /></div><div style={{ marginTop: 20 }}><Field label="Candidate Notes" color={theme.muted}><TextArea value={form.candidateNotes} onChange={(event) => updateForm("candidateNotes", event.target.value)} border={theme.inputBorder} /></Field></div><div style={{ marginTop: 20 }}><Button primary onClick={generateOutput}>Generate Output</Button></div></Card><Card title="Recent Candidates" subtitle="Reload recent candidate data quickly." theme={theme}><div style={{ display: "grid", gap: 10 }}>{recentCandidates.map((candidate, index) => <button key={`${candidate.fullName}-${index}`} type="button" onClick={() => setForm(candidate)} style={{ textAlign: "left", border: `1px solid ${theme.cardBorder}`, borderRadius: 14, padding: 12, background: "#ffffff", cursor: "pointer" }}><div style={{ fontWeight: 700, fontSize: 13 }}>{candidate.fullName || "Unnamed Candidate"}</div><div style={{ marginTop: 4, fontSize: 13, color: "#64748b" }}>{candidate.position || "No position"} • {candidate.siteName || "No site"}</div></button>)}</div></Card></div><Card title="Generated Output" subtitle="Professional hiring manager email, ATS short block, and candidate confirmation email." theme={theme}>{!output ? <div style={{ border: `1px dashed ${theme.cardBorder}`, borderRadius: 16, padding: 28, textAlign: "center", color: theme.muted }}>Fill the form, then click Generate Output.</div> : <div style={{ display: "grid", gap: 22 }}><OutputBlock title="Hiring Manager Email" badge="Professional Format" value={output.hiringManagerEmail} theme={theme} /><OutputBlock title="ATS Summary Block" badge="Short Version" value={output.atsShort} theme={theme} /><OutputBlock title="Candidate Email" badge="Confirmation Option" value={output.candidateEmail} theme={theme} /></div>}</Card></div> : activePage === "submissions" ? <Card title="Submissions" subtitle="Submission history is kept separate from the intake page." theme={theme}>{!submissionHistory.length ? <div style={{ border: `1px dashed ${theme.cardBorder}`, borderRadius: 16, padding: 24, textAlign: "center", color: theme.muted }}>No submissions generated yet.</div> : <div style={{ display: "grid", gap: 12 }}>{submissionHistory.map((item) => <button key={item.id} type="button" onClick={() => { setOutput(item.output); setActivePage("submission"); }} style={{ textAlign: "left", border: `1px solid ${theme.cardBorder}`, borderRadius: 16, padding: 14, background: "#ffffff", cursor: "pointer" }}><div style={{ fontWeight: 700, fontSize: 13 }}>{item.candidate} | {item.position}</div><div style={{ marginTop: 4, color: "#64748b", fontSize: 13 }}>{item.site} • {item.date}</div></button>)}</div>}</Card> : <div style={{ display: "grid", gap: 24, gridTemplateColumns: "260px 1fr" }}><aside style={{ background: theme.sidebarBg, border: `1px solid ${theme.cardBorder}`, borderRadius: 20, padding: 16 }}><div style={{ marginBottom: 12, padding: 12, borderRadius: 14, background: `linear-gradient(135deg, ${theme.badgeBlueBg} 0%, ${theme.badgeSlateBg} 100%)`, color: theme.badgeBlueText, fontWeight: 700, fontSize: 13 }}>{BRAND.appName} Setup</div><div style={{ display: "grid", gap: 8 }}>{[["general", "Workspace Setup"], ["sites", "Sites"], ["roles", "Roles"], ["compensation", "Compensation Structure"], ["shifts", "Shifts + Core Options"], ["templates", "Templates"], ["imports", "Imports + Templates"]].map(([key, label]) => <NavButton key={key} active={activeSettingsTab === key} onClick={() => setActiveSettingsTab(key)}>{label}</NavButton>)}</div></aside><div style={{ display: "grid", gap: 24 }}>{activeSettingsTab === "general" ? <Card title="Workspace Setup" subtitle="This personalizes the app immediately." theme={theme}><div style={fieldGrid}><Field label="Workspace Name" color={theme.muted}><TextInput value={settings.general.workspaceName} onChange={(event) => updateGeneral("workspaceName", event.target.value)} border={theme.inputBorder} /></Field><Field label="Company Name" color={theme.muted}><TextInput value={settings.general.companyName} onChange={(event) => updateGeneral("companyName", event.target.value)} border={theme.inputBorder} /></Field><Field label="Recruiter Name" color={theme.muted}><TextInput value={settings.general.recruiterName} onChange={(event) => updateGeneral("recruiterName", event.target.value)} border={theme.inputBorder} /></Field><Field label="Recruiter Email" color={theme.muted}><TextInput value={settings.general.recruiterEmail} onChange={(event) => updateGeneral("recruiterEmail", event.target.value)} border={theme.inputBorder} /></Field><Field label="Recruiter Phone" color={theme.muted}><TextInput value={settings.general.recruiterPhone} onChange={(event) => updateGeneral("recruiterPhone", event.target.value)} border={theme.inputBorder} /></Field><Field label="Sign-Off Name" color={theme.muted}><TextInput value={settings.general.signOffName} onChange={(event) => updateGeneral("signOffName", event.target.value)} border={theme.inputBorder} /></Field><div style={{ gridColumn: "1 / -1" }}><Field label="Sign-Off Line" color={theme.muted}><TextArea value={settings.general.signOffLine} onChange={(event) => updateGeneral("signOffLine", event.target.value)} border={theme.inputBorder} /></Field></div></div></Card> : null}{activeSettingsTab === "sites" ? <Card title="Sites / Locations" subtitle="Add locations and upload site files directly here." theme={theme} action={<div style={{ display: "flex", gap: 8 }}><Button onClick={addSite}>Add Site</Button><Button onClick={() => openImport("sites")}>Upload Sites</Button></div>}><div style={{ display: "grid", gap: 16 }}>{settings.sites.map((site) => <div key={site.id} style={{ border: `1px solid ${theme.cardBorder}`, borderRadius: 16, padding: 16, background: "#ffffff" }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}><strong>Site Record</strong><Button onClick={() => removeSite(site.id)} style={{ borderColor: "#fecaca", color: "#b91c1c" }}>Delete</Button></div><div style={fieldGrid}><Field label="Site Name" color={theme.muted}><TextInput value={site.siteName} onChange={(event) => updateSite(site.id, "siteName", event.target.value)} border={theme.inputBorder} /></Field><Field label="Site Type" color={theme.muted}><TextInput value={site.siteType} onChange={(event) => updateSite(site.id, "siteType", event.target.value)} border={theme.inputBorder} /></Field><Field label="Location" color={theme.muted}><TextInput value={site.location} onChange={(event) => updateSite(site.id, "location", event.target.value)} border={theme.inputBorder} /></Field><Field label="Status" color={theme.muted}><SelectInput value={site.status} onChange={(event) => updateSite(site.id, "status", event.target.value)} options={["Active", "Inactive"]} border={theme.inputBorder} /></Field></div></div>)}</div></Card> : null}{activeSettingsTab === "roles" ? <><Card title="Role Category Options" subtitle="Edit the Role Category dropdown list here." theme={theme}><TagListEditor label="Role Categories" values={settings.options.roleTypes} onChange={(value) => updateOptions("roleTypes", value)} theme={theme} /></Card><Card title="Roles" subtitle="Add positions and define requirements." theme={theme} action={<div style={{ display: "flex", gap: 8 }}><Button onClick={addRole}>Add Role</Button><Button onClick={() => openImport("roles")}>Upload Roles</Button></div>}><div style={{ display: "grid", gap: 16 }}>{settings.roles.map((role) => <div key={role.id} style={{ border: `1px solid ${theme.cardBorder}`, borderRadius: 16, padding: 16, background: "#ffffff" }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}><strong>Role Record</strong><Button onClick={() => removeRole(role.id)} style={{ borderColor: "#fecaca", color: "#b91c1c" }}>Delete</Button></div><div style={fieldGrid}><Field label="Position Title" color={theme.muted}><TextInput value={role.positionTitle} onChange={(event) => updateRole(role.id, "positionTitle", event.target.value)} border={theme.inputBorder} /></Field><Field label="Role Category" color={theme.muted}><SelectInput value={role.roleCategory} onChange={(event) => updateRole(role.id, "roleCategory", event.target.value)} options={settings.options.roleTypes} border={theme.inputBorder} /></Field><ToggleField label="Requires License" checked={role.requiresLicense} onChange={(value) => updateRole(role.id, "requiresLicense", value)} theme={theme} /><ToggleField label="Requires CPR" checked={role.requiresCpr} onChange={(value) => updateRole(role.id, "requiresCpr", value)} theme={theme} /><ToggleField label="Requires Work Expectations" checked={role.requiresWorkExpectations} onChange={(value) => updateRole(role.id, "requiresWorkExpectations", value)} theme={theme} /><Field label="Status" color={theme.muted}><SelectInput value={role.status} onChange={(event) => updateRole(role.id, "status", event.target.value)} options={["Active", "Inactive"]} border={theme.inputBorder} /></Field></div></div>)}</div></Card></> : null}{activeSettingsTab === "compensation" ? <Card title="Compensation Structure" subtitle="Hourly or salary, years-based, flat, or custom, with shift differentials." theme={theme} action={<div style={{ display: "flex", gap: 8 }}><Button onClick={addCompRule}>Add Rule</Button><Button onClick={() => openImport("rates")}>Upload Rates</Button></div>}><div style={{ marginBottom: 16 }}><ToggleField label="Enable Compensation Structure" checked={settings.compensationStructure.enabled} onChange={(value) => setSettings((prev) => ({ ...prev, compensationStructure: { ...prev.compensationStructure, enabled: value } }))} theme={theme} /></div><div style={{ display: "grid", gap: 16 }}>{settings.compensationStructure.rules.map((rule) => <div key={rule.id} style={{ border: `1px solid ${theme.cardBorder}`, borderRadius: 16, padding: 16, background: "#ffffff" }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}><strong>Compensation Rule</strong><Button onClick={() => removeCompRule(rule.id)} style={{ borderColor: "#fecaca", color: "#b91c1c" }}>Delete</Button></div><div style={fieldGrid}><Field label="Position" color={theme.muted}><SelectInput value={rule.positionTitle} onChange={(event) => updateCompRule(rule.id, "positionTitle", event.target.value)} options={settings.roles.map((role) => role.positionTitle).filter(Boolean)} border={theme.inputBorder} /></Field><Field label="Scope Type" color={theme.muted}><SelectInput value={rule.scopeType} onChange={(event) => updateCompRule(rule.id, "scopeType", event.target.value)} options={["Site Type", "Site"]} border={theme.inputBorder} /></Field><Field label="Scope Value" color={theme.muted}><TextInput value={rule.scopeValue} onChange={(event) => updateCompRule(rule.id, "scopeValue", event.target.value)} border={theme.inputBorder} /></Field><Field label="Compensation Type" color={theme.muted}><SelectInput value={rule.compensationType} onChange={(event) => updateCompRule(rule.id, "compensationType", event.target.value)} options={COMP_TYPES} border={theme.inputBorder} /></Field><Field label="Basis Type" color={theme.muted}><SelectInput value={rule.basisType} onChange={(event) => updateCompRule(rule.id, "basisType", event.target.value)} options={COMP_BASIS} border={theme.inputBorder} /></Field><Field label="Experience Tier" color={theme.muted}><SelectInput value={rule.experienceTier} onChange={(event) => updateCompRule(rule.id, "experienceTier", event.target.value)} options={["0–2", "3–5", "6–10", "11–15", "16+"]} border={theme.inputBorder} /></Field><Field label="Base Amount" color={theme.muted}><TextInput value={rule.baseAmount} onChange={(event) => updateCompRule(rule.id, "baseAmount", event.target.value)} border={theme.inputBorder} /></Field><Field label="Night Differential" color={theme.muted}><TextInput value={rule.shiftDifferentialNight} onChange={(event) => updateCompRule(rule.id, "shiftDifferentialNight", event.target.value)} border={theme.inputBorder} /></Field><Field label="Weekend Differential" color={theme.muted}><TextInput value={rule.shiftDifferentialWeekend} onChange={(event) => updateCompRule(rule.id, "shiftDifferentialWeekend", event.target.value)} border={theme.inputBorder} /></Field><Field label="Evening Differential" color={theme.muted}><TextInput value={rule.shiftDifferentialEvening} onChange={(event) => updateCompRule(rule.id, "shiftDifferentialEvening", event.target.value)} border={theme.inputBorder} /></Field></div></div>)}</div></Card> : null}{activeSettingsTab === "shifts" ? <Card title="Shifts + Core Options" subtitle="Shift preferences, work types, start dates, and FTE display." theme={theme} action={<Button onClick={() => openImport("shifts")}>Upload Shifts</Button>}><div style={fieldGrid}><TagListEditor label="Shift Preferences" values={settings.options.shiftOptions} onChange={(value) => updateOptions("shiftOptions", value)} theme={theme} /><TagListEditor label="Work Types" values={settings.options.workTypes} onChange={(value) => updateOptions("workTypes", value)} theme={theme} /><TagListEditor label="Start Date Options" values={settings.options.startAvailabilityOptions} onChange={(value) => updateOptions("startAvailabilityOptions", value)} theme={theme} /><div style={{ border: `1px solid ${theme.cardBorder}`, borderRadius: 16, padding: 16, background: "#ffffff", color: "#0f172a" }}><strong>FTE Display</strong><div style={{ display: "grid", gap: 8, marginTop: 10 }}>{FTE_OPTIONS.map((item) => <div key={item.value}>{item.label}</div>)}</div></div></div></Card> : null}{activeSettingsTab === "templates" ? <Card title="Templates" subtitle="Customize hiring manager, ATS, and candidate email text." theme={theme}><div style={fieldGrid}><Field label="Intro Line" color={theme.muted}><TextInput value={settings.templates.introLine} onChange={(event) => updateTemplates("introLine", event.target.value)} border={theme.inputBorder} /></Field><Field label="Closing Line" color={theme.muted}><TextInput value={settings.templates.closingLine} onChange={(event) => updateTemplates("closingLine", event.target.value)} border={theme.inputBorder} /></Field><Field label="Follow-Up Line" color={theme.muted}><TextInput value={settings.templates.followUpLine} onChange={(event) => updateTemplates("followUpLine", event.target.value)} border={theme.inputBorder} /></Field><div /><div style={{ gridColumn: "1 / -1" }}><Field label="Candidate Email Intro" color={theme.muted}><TextArea value={settings.templates.candidateEmailIntro} onChange={(event) => updateTemplates("candidateEmailIntro", event.target.value)} border={theme.inputBorder} /></Field></div><div style={{ gridColumn: "1 / -1" }}><Field label="Candidate Next Step 1" color={theme.muted}><TextArea value={settings.templates.candidateEmailNextStep1} onChange={(event) => updateTemplates("candidateEmailNextStep1", event.target.value)} border={theme.inputBorder} /></Field></div><div style={{ gridColumn: "1 / -1" }}><Field label="Candidate Next Step 2" color={theme.muted}><TextArea value={settings.templates.candidateEmailNextStep2} onChange={(event) => updateTemplates("candidateEmailNextStep2", event.target.value)} border={theme.inputBorder} /></Field></div><div style={{ gridColumn: "1 / -1" }}><Field label="Candidate Next Step 3" color={theme.muted}><TextArea value={settings.templates.candidateEmailNextStep3} onChange={(event) => updateTemplates("candidateEmailNextStep3", event.target.value)} border={theme.inputBorder} /></Field></div></div></Card> : null}{activeSettingsTab === "imports" ? <><Card title="Downloadable Templates" subtitle="Use templates to format uploads before importing on each page." theme={theme}><div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}><Button onClick={() => downloadTemplate("locations")}>Locations Template</Button><Button onClick={() => downloadTemplate("roles")}>Roles Template</Button><Button onClick={() => downloadTemplate("rateTables")}>Rate Tables Template</Button><Button onClick={() => downloadTemplate("shifts")}>Shift Details Template</Button><Button onClick={() => downloadTemplate("customFields")}>Custom Fields Template</Button></div></Card><Card title="Upload Guidance" subtitle="Uploads are located on the page they feed into: Sites, Roles, Compensation Structure, and Shifts + Core Options." theme={theme}><p style={{ margin: 0, color: theme.muted, lineHeight: 1.7 }}>Supported formats: PDF, DOCX, TXT, XLSX, CSV. Parsing into records is the next build layer, but the page-specific upload flow is now in the right place.</p><label style={{ display: "inline-flex", alignItems: "center", marginTop: 16, padding: "11px 16px", borderRadius: 12, border: `1px solid ${theme.inputBorder}`, fontWeight: 700, cursor: "pointer", fontSize: 13, background: "#ffffff", color: "#0f172a" }}>Import Saved Settings<input type="file" accept="application/json" onChange={(event) => importSettings(event)} style={{ display: "none" }} /></label></Card></> : null}</div></div>}
    <input ref={importInputRef} type="file" multiple style={{ display: "none" }} onChange={(event) => handleImport(event.target.files)} />
    <footer style={{ marginTop: 24, textAlign: "center", color: theme.muted, fontSize: 13 }}>{BRAND.footer}</footer>
  </div></div>;
}