import React, { useEffect, useMemo, useRef, useState } from "react";

const NL = String.fromCharCode(10);
const STORAGE_KEY = "welcomeflow-final-v2";
const TRACKER_KEY = "welcomeflow-final-v2-tracker";
const RECENT_KEY = "welcomeflow-final-v2-recent";

const BRAND = {
  appName: "WelcomeFlow: Recruiting Assistant",
  tagline: "From recruiter notes to submission, tracking, follow-up, and outcome intelligence.",
  footer: "© Central 54 Holdings LLC",
};

const THEMES = {
  corporate: {
    name: "Corporate Premium",
    pageBg: "linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)",
    cardBg: "rgba(255,255,255,0.98)",
    cardBorder: "#e2e8f0",
    text: "#0f172a",
    muted: "#64748b",
    inputBorder: "#d7deea",
    sidebarBg: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
    accent: "#2563eb",
    navy: "#0f172a",
    blueBg: "#dbeafe",
    blueText: "#1d4ed8",
    greenBg: "#d1fae5",
    greenText: "#047857",
    goldBg: "#fef3c7",
    goldText: "#92400e",
    redBg: "#fee2e2",
    redText: "#b91c1c",
    slateBg: "#f1f5f9",
    slateText: "#475569",
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
    accent: "#38bdf8",
    navy: "#020617",
    blueBg: "#1e3a8a",
    blueText: "#dbeafe",
    greenBg: "#064e3b",
    greenText: "#d1fae5",
    goldBg: "#78350f",
    goldText: "#fde68a",
    redBg: "#7f1d1d",
    redText: "#fecaca",
    slateBg: "#334155",
    slateText: "#e2e8f0",
  },
};

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
    roleTypes: ["Healthcare", "Other"],
    workTypes: ["On-site", "Remote", "Hybrid"],
    employmentTypes: ["FT", "PT", "PRN", "Contract", "FT or PT"],
    shiftOptions: ["Day", "Night", "Evening", "Day or Night", "Evening or Night", "Any Shift"],
    startOptions: ["Immediate", "2–4 weeks", "4–6 weeks", "3 months", "6 months"],
    educationLevels: ["High School", "Associate's", "Bachelor's", "Bachelor of Science in Nursing", "Master's", "Doctorate", "Certification / Trade"],
    licenseStatuses: ["Active/Clear", "Active/Encumbered", "Inactive", "Pending", "Not Verified", "Not Required"],
    cprStatuses: ["Active", "Inactive", "Pending", "Not Required"],
    otOptions: ["None", "Occasional", "Required"],
    weekendOptions: ["None", "Rotating", "Required"],
    onCallOptions: ["None", "Occasional", "Required"],
    trackerStatuses: ["Draft", "Submitted", "Awaiting Client Review", "Follow-Up Due", "Interview Requested", "Interview Scheduled", "Offer Pending", "Placed", "Rejected", "Closed"],
    outcomes: ["Pending", "Interview", "Offer", "Placed", "Rejected", "No Response", "Withdrawn"],
  },
  sites: [
    { id: "site-1", siteName: "Demo Facility", siteType: "24-hour", location: "Douglasville, GA", facilityEmail: "", status: "Active", notes: "" },
  ],
  roles: [
    { id: "role-1", positionTitle: "Registered Nurse", roleCategory: "Healthcare", requiresLicense: true, requiresCpr: true, requiresFte: true, requiresShift: true, requiresWorkExpectations: true, status: "Active" },
    { id: "role-2", positionTitle: "Administrative Assistant", roleCategory: "Other", requiresLicense: false, requiresCpr: false, requiresFte: false, requiresShift: false, requiresWorkExpectations: true, status: "Active" },
  ],
  compensationRules: [
    { id: "rate-1", positionTitle: "Registered Nurse", scopeType: "Site Type", scopeValue: "24-hour", compensationType: "Hourly", basisType: "Years-based", experienceTier: "6–10", baseAmount: "$42.25/hr", nightDiff: "$2.00/hr", weekendDiff: "$1.50/hr", eveningDiff: "$1.00/hr" },
  ],
  templates: {
    introLine: "Please review the candidate below for consideration.",
    closingLine: "The candidate has been briefed on the role expectations and is prepared to move forward.",
    followUpLine: "Please advise next steps within 24–48 hours.",
    candidateIntro: "Thank you for taking the time to speak with me today.",
    candidateStep1: "Your information is currently being reviewed by the hiring team.",
    candidateStep2: "If selected, the facility may reach out directly regarding interview coordination.",
    candidateStep3: "I will continue to monitor your submission and share updates as they become available.",
    candidateTiming: "You can expect an update within 24–48 hours.",
    candidateSupport: "If anything changes on your end, please feel free to reach out directly.",
  },
  workflow: {
    requireApprovalBeforeSending: true,
    openHiringEmail: true,
    openCandidateEmail: true,
    logToTracker: true,
    setFollowUpReminder: true,
    defaultFollowUpDays: 2,
    mediumRiskDays: 3,
    highRiskDays: 5,
    autoStatusAfterSubmit: "Awaiting Client Review",
  },
};

const FTE_OPTIONS = [
  { label: "40 hrs/week (1.0)", value: "1.0" },
  { label: "36 hrs/week (0.9)", value: "0.9" },
  { label: "32 hrs/week (0.8)", value: "0.8" },
  { label: "24 hrs/week (0.6)", value: "0.6" },
  { label: "20 hrs/week (0.5)", value: "0.5" },
  { label: "16 hrs/week (0.4)", value: "0.4" },
  { label: "PRN", value: "PRN" },
];

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
  recruiterNotes: "",
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

function id(prefix) { return `${prefix}-${Math.random().toString(36).slice(2, 9)}`; }
function todayString() { return new Date().toLocaleDateString("en-US"); }
function addDays(days) { const d = new Date(); d.setDate(d.getDate() + Number(days || 0)); return d.toISOString().slice(0, 10); }
function daysBetween(dateText) { if (!dateText) return 0; const then = new Date(dateText); const now = new Date(); return Math.max(0, Math.floor((now - then) / 86400000)); }
function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
function load(key, fallback) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } }
function fteLabel(value) { const found = FTE_OPTIONS.find((item) => item.value === value); return found ? found.label : value || "N/A"; }
function tierFromYears(value) { const y = Number(value || 0); if (y <= 2) return "0–2"; if (y <= 5) return "3–5"; if (y <= 10) return "6–10"; if (y <= 15) return "11–15"; return "16+"; }
function copyText(text) { if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).catch(() => {}); }
function downloadTextFile(name, content, type = "text/csv") { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url); }

function parseNotesToForm(notes, settings, currentForm) {
  const text = notes || "";
  const lower = text.toLowerCase();
  const next = { ...currentForm, recruiterNotes: notes };

  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (email) next.emailAddress = email[0];

  const phone = text.match(/(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}/);
  if (phone) next.phoneNumber = phone[0];

  const years = text.match(/(\d{1,2})\s*(?:\+)?\s*(?:years|yrs|year)/i);
  if (years) next.yearsExperience = years[1];

  const role = settings.roles.find((item) => lower.includes(item.positionTitle.toLowerCase()) || lower.includes(item.positionTitle.toLowerCase().replace("registered nurse", "rn")));
  if (role) { next.position = role.positionTitle; next.roleCategory = role.roleCategory; }
  else if (lower.includes("rn")) { next.position = "Registered Nurse"; next.roleCategory = "Healthcare"; }

  if (lower.includes("day")) next.shiftPreference = "Day";
  if (lower.includes("night")) next.shiftPreference = "Night";
  if (lower.includes("evening")) next.shiftPreference = "Evening";
  if (lower.includes("remote")) next.workType = "Remote";
  else if (lower.includes("hybrid")) next.workType = "Hybrid";
  else if (lower.includes("on-site") || lower.includes("onsite")) next.workType = "On-site";

  if (lower.includes("immediate")) next.startAvailability = "Immediate";
  else if (lower.includes("2 week") || lower.includes("two week") || lower.includes("2-week")) { next.startAvailability = "2–4 weeks"; next.startNotes = "Needs to give two-week notice"; }
  else if (lower.includes("4-6") || lower.includes("4–6")) next.startAvailability = "4–6 weeks";

  if (lower.includes("active license") || lower.includes("license active") || lower.includes("active/clear")) next.licenseStatus = "Active/Clear";
  if (lower.includes("cpr")) next.cprStatus = "Active";
  if (lower.includes("weekend")) next.weekendRequirement = lower.includes("rotating") ? "Rotating" : "Required";
  if (lower.includes("no on-call") || lower.includes("no on call")) next.onCallRequirement = "None";
  if (lower.includes("overtime") || lower.includes(" ot ")) next.otRequirement = "Occasional";

  const experienceBits = [];
  if (lower.includes("correction")) experienceBits.push("Corrections experience");
  if (lower.includes("med-surg") || lower.includes("med surg")) experienceBits.push("Med-Surg experience");
  if (lower.includes("behavioral")) experienceBits.push("Behavioral Health experience");
  if (lower.includes("er") || lower.includes("emergency")) experienceBits.push("ER experience");
  if (lower.includes("strong communicator") || lower.includes("communication")) experienceBits.push("Strong communicator");
  if (experienceBits.length) next.experienceNotes = experienceBits.join(" | ");

  const nameMatch = text.match(/(?:candidate|name)[:\s]+([A-Z][a-z]+\s+[A-Z][a-z]+)/);
  if (nameMatch) next.fullName = nameMatch[1];

  return next;
}

function Button({ children, onClick, primary, style, type = "button" }) {
  return <button type={type} onClick={onClick} style={{ padding: "11px 16px", borderRadius: 12, border: primary ? "1px solid #0f172a" : "1px solid #d7deea", background: primary ? "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)" : "#ffffff", color: primary ? "#ffffff" : "#0f172a", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "Arial, sans-serif", ...style }}>{children}</button>;
}
function Card({ title, subtitle, children, action, theme }) { return <section style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}`, borderRadius: 20, padding: 24, boxShadow: "0 10px 26px rgba(15,23,42,0.06)" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 20 }}><div><h2 style={{ margin: 0, color: theme.text, fontSize: 22 }}>{title}</h2>{subtitle ? <p style={{ margin: "8px 0 0", color: theme.muted, lineHeight: 1.6, fontSize: 13 }}>{subtitle}</p> : null}</div>{action}</div>{children}</section>; }
function Field({ label, children, color }) { return <label style={{ display: "block" }}><div style={{ marginBottom: 6, color, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>{children}</label>; }
function TextInput({ value, onChange, placeholder, type = "text", readOnly, border }) { return <input value={value} onChange={onChange} placeholder={placeholder || ""} type={type} readOnly={readOnly} style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: `1px solid ${border}`, boxSizing: "border-box", background: readOnly ? "#f8fafc" : "#ffffff", color: "#0f172a", outline: "none", fontSize: 13, fontFamily: "Arial, sans-serif" }} />; }
function TextArea({ value, onChange, placeholder, border, minHeight = 96 }) { return <textarea value={value} onChange={onChange} placeholder={placeholder || ""} style={{ width: "100%", minHeight, padding: "12px 14px", borderRadius: 12, border: `1px solid ${border}`, boxSizing: "border-box", resize: "vertical", background: "#ffffff", color: "#0f172a", outline: "none", fontSize: 13, fontFamily: "Arial, sans-serif" }} />; }
function SelectInput({ value, onChange, options, placeholder, border }) { return <select value={value} onChange={onChange} style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: `1px solid ${border}`, boxSizing: "border-box", background: "#ffffff", color: "#0f172a", outline: "none", fontSize: 13, fontFamily: "Arial, sans-serif" }}><option value="">{placeholder || "Select"}</option>{options.map((option) => { const key = typeof option === "string" ? option : option.value; const label = typeof option === "string" ? option : option.label; return <option key={key} value={key}>{label}</option>; })}</select>; }
function ToggleField({ label, checked, onChange, theme }) { return <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: `1px solid ${theme.cardBorder}`, borderRadius: 12, padding: 12, background: "#ffffff", color: "#0f172a" }}><span style={{ fontWeight: 700, fontSize: 13 }}>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /></label>; }
function Badge({ children, bg, color }) { return <span style={{ display: "inline-flex", alignItems: "center", padding: "7px 11px", borderRadius: 999, background: bg, color, fontSize: 12, fontWeight: 700 }}>{children}</span>; }
function NavButton({ active, children, onClick }) { return <button type="button" onClick={onClick} style={{ width: "100%", textAlign: "left", padding: "12px 14px", borderRadius: 12, border: active ? "1px solid #1e3a8a" : "1px solid transparent", background: active ? "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)" : "transparent", color: active ? "#ffffff" : "#334155", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{children}</button>; }
function OutputBlock({ title, badge, value, theme }) { return <div><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, alignItems: "center" }}><div style={{ display: "flex", gap: 8, alignItems: "center" }}><strong style={{ color: theme.muted, fontSize: 12, textTransform: "uppercase" }}>{title}</strong>{badge ? <Badge bg={theme.blueBg} color={theme.blueText}>{badge}</Badge> : null}</div><Button onClick={() => copyText(value)}>Copy</Button></div><pre style={{ margin: 0, whiteSpace: "pre-wrap", background: "#ffffff", color: "#0f172a", border: `1px solid ${theme.cardBorder}`, borderRadius: 16, padding: 18, lineHeight: 1.75, fontFamily: "Arial, sans-serif", fontSize: 13 }}>{value}</pre></div>; }
function TagEditor({ label, values, onChange, theme }) { const [draft, setDraft] = useState(""); function add() { const clean = draft.trim(); if (!clean || values.includes(clean)) return; onChange([...values, clean]); setDraft(""); } return <div style={{ background: "#ffffff", color: "#0f172a", border: `1px solid ${theme.cardBorder}`, borderRadius: 16, padding: 16 }}><strong>{label}</strong><div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "12px 0" }}>{values.map((value) => <span key={value} style={{ display: "inline-flex", gap: 8, alignItems: "center", padding: "6px 9px", borderRadius: 999, background: "#eef2ff", border: "1px solid #dbe4f0", fontSize: 12 }}>{value}<button type="button" onClick={() => onChange(values.filter((item) => item !== value))} style={{ border: "none", background: "transparent", cursor: "pointer" }}>×</button></span>)}</div><div style={{ display: "flex", gap: 8 }}><TextInput value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Add option" border={theme.inputBorder} /><Button onClick={add}>Add</Button></div></div>; }

export default function App() {
  const [activePage, setActivePage] = useState("submission");
  const [activeSettingsTab, setActiveSettingsTab] = useState("general");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [form, setForm] = useState(DEMO_FORM);
  const [recentCandidates, setRecentCandidates] = useState([DEMO_FORM]);
  const [tracker, setTracker] = useState([]);
  const [output, setOutput] = useState(null);
  const [themeKey, setThemeKey] = useState("corporate");
  const [loaded, setLoaded] = useState(false);
  const [importMode, setImportMode] = useState("general");
  const importInputRef = useRef(null);

  useEffect(() => { setSettings(load(STORAGE_KEY, DEFAULT_SETTINGS)); setTracker(load(TRACKER_KEY, [])); setRecentCandidates(load(RECENT_KEY, [DEMO_FORM])); setLoaded(true); }, []);
  useEffect(() => { if (loaded) save(STORAGE_KEY, settings); }, [settings, loaded]);
  useEffect(() => { if (loaded) save(TRACKER_KEY, tracker); }, [tracker, loaded]);
  useEffect(() => { if (loaded) save(RECENT_KEY, recentCandidates); }, [recentCandidates, loaded]);

  const theme = THEMES[themeKey] || THEMES.corporate;
  const activeRoles = useMemo(() => settings.roles.filter((role) => role.status === "Active"), [settings.roles]);
  const activeSites = useMemo(() => settings.sites.filter((site) => site.status === "Active"), [settings.sites]);
  const selectedRole = useMemo(() => activeRoles.find((role) => role.positionTitle === form.position) || null, [activeRoles, form.position]);
  const selectedSite = useMemo(() => activeSites.find((site) => site.siteName === form.siteName) || null, [activeSites, form.siteName]);
  const isHealthcare = (form.roleCategory || selectedRole?.roleCategory) === "Healthcare";
  const setupProgress = useMemo(() => { const checks = [settings.general.recruiterName || settings.general.companyName, settings.sites.length, settings.roles.length, settings.compensationRules.length, settings.templates.introLine]; const complete = checks.filter(Boolean).length; return { complete, total: 5, percent: Math.round((complete / 5) * 100) }; }, [settings]);

  const estimatedComp = useMemo(() => {
    if (!form.position) return "";
    const tier = tierFromYears(form.yearsExperience);
    const match = settings.compensationRules.find((rule) => {
      const positionMatch = rule.positionTitle === form.position;
      const scopeMatch = rule.scopeType === "Site Type" ? rule.scopeValue === (selectedSite?.siteType || "") : rule.scopeValue === form.siteName;
      const basisMatch = rule.basisType === "Flat" || rule.basisType === "Custom" || rule.experienceTier === tier;
      return positionMatch && scopeMatch && basisMatch;
    });
    if (!match) return "";
    const extras = [];
    if (form.shiftPreference === "Night" && match.nightDiff) extras.push(`Night: ${match.nightDiff}`);
    if (form.shiftPreference === "Evening" && match.eveningDiff) extras.push(`Evening: ${match.eveningDiff}`);
    if ((form.weekendRequirement === "Required" || form.weekendRequirement === "Rotating") && match.weekendDiff) extras.push(`Weekend: ${match.weekendDiff}`);
    return extras.length ? `${match.baseAmount} base | ${extras.join(" | ")}` : match.baseAmount;
  }, [settings.compensationRules, form.position, form.yearsExperience, form.siteName, form.shiftPreference, form.weekendRequirement, selectedSite]);

  function updateForm(key, value) { setForm((prev) => ({ ...prev, [key]: value })); }
  function updateSettings(section, key, value) { setSettings((prev) => ({ ...prev, [section]: { ...prev[section], [key]: value } })); }
  function updateOptions(key, value) { setSettings((prev) => ({ ...prev, options: { ...prev.options, [key]: value } })); }
  function updateArray(section, itemId, key, value) { setSettings((prev) => ({ ...prev, [section]: prev[section].map((item) => item.id === itemId ? { ...item, [key]: value } : item) })); }
  function addSite() { setSettings((prev) => ({ ...prev, sites: [...prev.sites, { id: id("site"), siteName: "", siteType: "", location: "", facilityEmail: "", status: "Active", notes: "" }] })); }
  function addRole() { setSettings((prev) => ({ ...prev, roles: [...prev.roles, { id: id("role"), positionTitle: "", roleCategory: "Other", requiresLicense: false, requiresCpr: false, requiresFte: false, requiresShift: false, requiresWorkExpectations: true, status: "Active" }] })); }
  function addRate() { setSettings((prev) => ({ ...prev, compensationRules: [...prev.compensationRules, { id: id("rate"), positionTitle: "", scopeType: "Site Type", scopeValue: "", compensationType: "Hourly", basisType: "Years-based", experienceTier: "0–2", baseAmount: "", nightDiff: "", weekendDiff: "", eveningDiff: "" }] })); }
  function removeFrom(section, itemId) { setSettings((prev) => ({ ...prev, [section]: prev[section].filter((item) => item.id !== itemId) })); }
  function openImport(mode) { setImportMode(mode); importInputRef.current?.click(); }
  function handleImport(files) { const incoming = Array.from(files || []); const bad = incoming.find((file) => !["PDF", "DOCX", "TXT", "XLSX", "CSV"].includes((file.name.split(".").pop() || "").toUpperCase())); if (bad) alert("Unsupported file format. Supported formats: PDF, Word, Text, Excel, and CSV."); else alert(`${incoming.length} file(s) accepted for ${importMode}. Parsing into records is a future build layer.`); }

  function getCredentials() { const values = []; if (!isHealthcare) return ""; if (form.licenseStatus) values.push(`License: ${form.licenseStatus}`); if (form.cprStatus) values.push(`CPR: ${form.cprStatus}`); if (form.licensedYear) values.push(`Licensed Since: ${form.licensedYear}`); return values.join(" | "); }
  function getStrengthHighlights() { const notes = `${form.experienceNotes || ""} ${form.candidateNotes || ""}`.toLowerCase(); const years = Number(form.yearsExperience || 0); const h = []; if (years >= 8) h.push(`${years}+ years of relevant experience`); else if (years >= 5) h.push(`${years} years of solid experience`); if (notes.includes("correction")) h.push("correctional healthcare experience"); if (notes.includes("med-surg") || notes.includes("med surg")) h.push("Med-Surg background"); if (notes.includes("er") || notes.includes("emergency")) h.push("ER experience"); if (notes.includes("behavioral") || notes.includes("psych")) h.push("behavioral health experience"); if (notes.includes("communication") || notes.includes("strong communicator")) h.push("strong communication skills"); if (form.licenseStatus === "Active/Clear") h.push("active/clear license"); if (form.cprStatus === "Active") h.push("active CPR"); if (form.scheduleConfirmed && form.weekendConfirmed && form.otConfirmed && form.onCallConfirmed) h.push("role expectations confirmed"); return [...new Set(h)].slice(0, 5); }
  function getStrengthLabel() { const years = Number(form.yearsExperience || 0); const count = getStrengthHighlights().length; if (years >= 8 && count >= 3) return "Strong Match"; if (years >= 5 && count >= 2) return "Good Match"; if (count >= 2) return "Potential Match"; return "Needs Review"; }
  function getSubject(kind) { const name = form.fullName || "Candidate"; const position = form.position || "Position"; const site = form.siteName || "Facility"; if (kind === "hiring") return `${getStrengthLabel()}: ${name} | ${position} | ${site}`; if (kind === "candidate") return `Submission Confirmation: ${position} | ${site}`; return `ATS Summary: ${name} | ${position} | ${site}`; }

  function buildHiringEmail(finalComp) {
    const facility = form.siteName || settings.general.companyName || "Hiring Team";
    const name = form.fullName || "The candidate";
    const position = form.position || "the position";
    const credentials = getCredentials();
    return [`Hello ${facility},`, "", settings.templates.introLine, "", `Submission Date: ${todayString()}`, "", `${name} is being submitted for the ${position} position at ${facility}.`, "", "Candidate Snapshot", `• Schedule: ${fteLabel(form.fte)}, ${form.shiftPreference || "N/A"}`, `• Location: ${form.location || selectedSite?.location || "N/A"}`, `• Compensation: ${form.compensationType || "Hourly"}, ${finalComp}`, `• Availability: ${form.startAvailability || "N/A"}`, `• Interview Availability: ${form.interviewAvailability || "N/A"}`, "", "Why This Candidate Stands Out", ...(getStrengthHighlights().length ? getStrengthHighlights().map((item) => `• ${item}`) : ["• Review full experience details before decision."]), "", "Experience & Credentials", `${name} brings ${form.yearsExperience || "N/A"} years of experience as a ${position}${form.experienceNotes ? `, including ${form.experienceNotes}.` : "."}`, form.educationLevel ? `Education: ${form.educationLevel}` : "", credentials ? credentials.replaceAll(" | ", NL) : "", "", "Work Expectations", `The candidate has confirmed availability for ${form.workSchedule || "N/A"}. OT is ${String(form.otRequirement || "N/A").toLowerCase()}, weekends are ${String(form.weekendRequirement || "N/A").toLowerCase()}, and on-call is ${String(form.onCallRequirement || "N/A").toLowerCase()}.`, form.workArea ? `Work Area: ${form.workArea}` : "", "", "Additional Notes", form.candidateNotes || "N/A", "", `${settings.templates.closingLine} ${settings.templates.followUpLine}`.trim(), "", settings.general.signOffName || settings.general.recruiterName || "", settings.general.signOffLine || ""].filter(Boolean).join(NL);
  }
  function buildAts(finalComp) { return [`Submittal Date: ${todayString()}`, `Recruiter: ${settings.general.recruiterName || "N/A"}`, "", "Candidate Details", `• ${form.fullName || "N/A"} | ${form.position || "N/A"} | ${form.siteName || "N/A"}`, `• Status: ${getStrengthLabel()}`, "", "Why This Candidate Stands Out", ...(getStrengthHighlights().length ? getStrengthHighlights().map((item) => `• ${item}`) : ["• Review full experience details before submission decision."]), "", "Quick Snapshot", `• Experience: ${form.yearsExperience || "N/A"} yrs | Compensation: ${finalComp}`, `• Start: ${form.startAvailability || "N/A"} | Interview: ${form.interviewAvailability || "N/A"}`, `• ${form.workType || "N/A"} | ${fteLabel(form.fte)} | ${form.shiftPreference || "N/A"}`, "", "Work Expectations", `• Schedule: ${form.workSchedule || "N/A"}`, `• OT: ${form.otRequirement || "N/A"} | Weekend: ${form.weekendRequirement || "N/A"} | On-Call: ${form.onCallRequirement || "N/A"}`, form.workArea ? `• Work Area: ${form.workArea}` : "", "", "Recommended Action", getStrengthLabel() === "Strong Match" ? "• Submit to hiring manager for immediate review." : "• Review details and confirm alignment before final submission."].filter(Boolean).join(NL); }
  function buildCandidateEmail(finalComp) { const position = `${form.position || "position"}${form.shiftPreference ? `, ${form.shiftPreference}` : ""}${form.employmentType ? `, ${form.employmentType}` : ""}`; return [`Hello ${form.fullName || "Candidate"},`, "", settings.templates.candidateIntro, "", `Your profile has been submitted for the ${position} position with ${form.siteName || "the facility"}.`, "", "Compensation Structure", `${form.compensationType || "Hourly"}: ${finalComp}`, "", "Next Steps", `• ${settings.templates.candidateStep1}`, `• ${settings.templates.candidateStep2}`, `• ${settings.templates.candidateStep3}`, "", settings.templates.candidateTiming, settings.templates.candidateSupport, "", settings.general.signOffName || settings.general.recruiterName || "", settings.general.signOffLine || ""].filter(Boolean).join(NL); }

  function generateOutput() { const finalComp = form.compensationRequested || estimatedComp || "TBD"; const generated = { finalComp, date: todayString(), hiringEmail: buildHiringEmail(finalComp), ats: buildAts(finalComp), candidateEmail: buildCandidateEmail(finalComp), hiringSubject: getSubject("hiring"), candidateSubject: getSubject("candidate"), atsSubject: getSubject("ats") }; setOutput(generated); setRecentCandidates((prev) => [form, ...prev.filter((item) => item.fullName !== form.fullName)].slice(0, 8)); return generated; }
  function logToTracker(generated = output) { const out = generated || generateOutput(); const record = { id: id("sub"), candidate: form.fullName || "Unnamed Candidate", position: form.position || "N/A", facility: form.siteName || "N/A", facilityEmail: selectedSite?.facilityEmail || "", recruiter: settings.general.recruiterName || "N/A", submittedDate: new Date().toISOString().slice(0, 10), status: settings.workflow.autoStatusAfterSubmit, dueDate: addDays(settings.workflow.defaultFollowUpDays), nextAction: "Follow up with facility", clientFeedback: "", outcome: "Pending", reason: "", output: out, strength: getStrengthLabel() }; setTracker((prev) => [record, ...prev]); return record; }
  function openEmail(kind, generated = output) { const out = generated || generateOutput(); const to = kind === "hiring" ? selectedSite?.facilityEmail || "" : kind === "candidate" ? form.emailAddress || "" : ""; const subject = kind === "hiring" ? out.hiringSubject : kind === "candidate" ? out.candidateSubject : out.atsSubject; const body = kind === "hiring" ? out.hiringEmail : kind === "candidate" ? out.candidateEmail : out.ats; window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`; }
  function submitCandidateFlow() { const generated = output || generateOutput(); if (settings.workflow.requireApprovalBeforeSending && !window.confirm("Approve this submission workflow?")) return; if (settings.workflow.logToTracker) logToTracker(generated); if (settings.workflow.openHiringEmail) openEmail("hiring", generated); if (settings.workflow.openCandidateEmail) setTimeout(() => openEmail("candidate", generated), 700); }
  function clearForm() { if (!window.confirm("Are you sure you want to clear all fields?")) return; setForm(DEFAULT_FORM); setOutput(null); }
  function applyNotes() { setForm((prev) => parseNotesToForm(prev.recruiterNotes, settings, prev)); }

  function trackerRisk(record) { const age = daysBetween(record.submittedDate); if (["Placed", "Rejected", "Closed"].includes(record.status)) return "Closed"; if (age >= Number(settings.workflow.highRiskDays)) return "High"; if (age >= Number(settings.workflow.mediumRiskDays)) return "Medium"; return "Low"; }
  function updateTracker(rowId, key, value) { setTracker((prev) => prev.map((row) => row.id === rowId ? { ...row, [key]: value } : row)); }
  function metrics() { const total = tracker.length; const interviews = tracker.filter((r) => ["Interview", "Offer", "Placed"].includes(r.outcome)).length; const offers = tracker.filter((r) => ["Offer", "Placed"].includes(r.outcome)).length; const placed = tracker.filter((r) => r.outcome === "Placed" || r.status === "Placed").length; const highRisk = tracker.filter((r) => trackerRisk(r) === "High").length; return { total, interviews, offers, placed, highRisk, submitToInterview: total ? Math.round((interviews / total) * 100) : 0, interviewToOffer: interviews ? Math.round((offers / interviews) * 100) : 0, placementRate: total ? Math.round((placed / total) * 100) : 0 }; }

  function downloadTemplate(kind) { const map = { sites: `siteName,siteType,location,facilityEmail,status,notes${NL}Demo Facility,24-hour,Douglasville GA,hiring@email.com,Active,`, roles: `positionTitle,roleCategory,requiresLicense,requiresCpr,requiresFte,requiresShift,requiresWorkExpectations,status${NL}Registered Nurse,Healthcare,true,true,true,true,true,Active`, rates: `positionTitle,scopeType,scopeValue,compensationType,basisType,experienceTier,baseAmount,nightDiff,weekendDiff,eveningDiff${NL}Registered Nurse,Site Type,24-hour,Hourly,Years-based,6–10,$42.25/hr,$2.00/hr,$1.50/hr,$1.00/hr`, shifts: `shiftOption${NL}Day${NL}Night${NL}Evening${NL}Any Shift` }; downloadTextFile(`${kind}-template.csv`, map[kind] || ""); }

  const m = metrics();
  const fieldGrid = { display: "grid", gap: 16, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" };
  const pageStyle = { minHeight: "100vh", background: theme.pageBg, color: theme.text, fontFamily: "Arial, sans-serif", fontSize: 13 };
  const shellStyle = { maxWidth: 1380, margin: "0 auto", padding: 28 };

  return <div style={pageStyle}><div style={shellStyle}>
    <Card title={BRAND.appName} subtitle={BRAND.tagline} theme={theme} action={<div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><Button primary={activePage === "submission"} onClick={() => setActivePage("submission")}>Submission</Button><Button primary={activePage === "tracker"} onClick={() => setActivePage("tracker")}>Submission Tracker</Button><Button primary={activePage === "metrics"} onClick={() => setActivePage("metrics")}>Metrics</Button><Button primary={activePage === "settings"} onClick={() => setActivePage("settings")}>Settings</Button></div>}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Badge bg={theme.blueBg} color={theme.blueText}>Workspace Ready</Badge><Badge bg={theme.greenBg} color={theme.greenText}>{settings.compensationRules.length} Rate Rules</Badge><Badge bg={theme.goldBg} color={theme.goldText}>{tracker.length} Tracked</Badge><Badge bg={theme.redBg} color={theme.redText}>{m.highRisk} High Risk</Badge></div><div style={{ minWidth: 190 }}><SelectInput value={themeKey} onChange={(e) => setThemeKey(e.target.value)} options={[{ label: "Corporate Premium", value: "corporate" }, { label: "Dark Premium", value: "dark" }]} border={theme.inputBorder} /></div></div>
    </Card>

    <div style={{ margin: "18px 0 24px", background: theme.cardBg, border: `1px solid ${theme.cardBorder}`, borderRadius: 20, padding: 18 }}><strong style={{ color: theme.muted, textTransform: "uppercase", fontSize: 11 }}>Setup Progress</strong><div style={{ marginTop: 8, height: 10, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" }}><div style={{ width: `${setupProgress.percent}%`, height: "100%", background: `linear-gradient(135deg, ${theme.navy} 0%, ${theme.accent} 100%)` }} /></div><p style={{ margin: "8px 0 0", color: theme.muted }}>{setupProgress.complete} of {setupProgress.total} setup areas complete, {setupProgress.percent}% done</p></div>

    {activePage === "submission" ? <div style={{ display: "grid", gap: 24, gridTemplateColumns: "1.05fr 0.95fr", alignItems: "start" }}>
      <div style={{ display: "grid", gap: 24 }}>
        <Card title="Notes-to-Profile Intake" subtitle="Paste call notes or a transcript. The app extracts a draft profile so the recruiter edits instead of starting blank." theme={theme} action={<Button onClick={applyNotes}>Extract Draft</Button>}><Field label="Recruiter Notes / Transcript" color={theme.muted}><TextArea value={form.recruiterNotes} onChange={(e) => updateForm("recruiterNotes", e.target.value)} placeholder="Example: Ashley Martin RN 10 yrs corrections med-surg, active license and CPR, needs two weeks notice, prefers day shift..." border={theme.inputBorder} minHeight={130} /></Field></Card>
        <Card title="Candidate Intake" subtitle="Submission page stays focused: no imports, no custom role creation, no candidate comments clutter." theme={theme} action={<div style={{ display: "flex", gap: 8 }}><Button onClick={() => setForm(DEMO_FORM)}>Load Demo</Button><Button onClick={clearForm}>Clear</Button></div>}><div style={fieldGrid}>
          <Field label="Position" color={theme.muted}><SelectInput value={form.position} onChange={(e) => updateForm("position", e.target.value)} options={activeRoles.map((r) => r.positionTitle)} placeholder="Select role" border={theme.inputBorder} /></Field>
          <Field label="Role Category" color={theme.muted}><SelectInput value={form.roleCategory || selectedRole?.roleCategory || ""} onChange={(e) => updateForm("roleCategory", e.target.value)} options={settings.options.roleTypes} border={theme.inputBorder} /></Field>
          <Field label="Full Name" color={theme.muted}><TextInput value={form.fullName} onChange={(e) => updateForm("fullName", e.target.value)} border={theme.inputBorder} /></Field>
          <Field label="Phone" color={theme.muted}><TextInput value={form.phoneNumber} onChange={(e) => updateForm("phoneNumber", e.target.value)} border={theme.inputBorder} /></Field>
          <Field label="Email" color={theme.muted}><TextInput value={form.emailAddress} onChange={(e) => updateForm("emailAddress", e.target.value)} border={theme.inputBorder} /></Field>
          <Field label="Location" color={theme.muted}><TextInput value={form.location} onChange={(e) => updateForm("location", e.target.value)} border={theme.inputBorder} /></Field>
          <Field label="Site / Facility" color={theme.muted}><SelectInput value={form.siteName} onChange={(e) => updateForm("siteName", e.target.value)} options={activeSites.map((s) => s.siteName)} border={theme.inputBorder} /></Field>
          <Field label="Employment Type" color={theme.muted}><SelectInput value={form.employmentType} onChange={(e) => updateForm("employmentType", e.target.value)} options={settings.options.employmentTypes} border={theme.inputBorder} /></Field>
          <Field label="Shift" color={theme.muted}><SelectInput value={form.shiftPreference} onChange={(e) => updateForm("shiftPreference", e.target.value)} options={settings.options.shiftOptions} border={theme.inputBorder} /></Field>
          <Field label="Work Type" color={theme.muted}><SelectInput value={form.workType} onChange={(e) => updateForm("workType", e.target.value)} options={settings.options.workTypes} border={theme.inputBorder} /></Field>
          <Field label="FTE" color={theme.muted}><SelectInput value={form.fte} onChange={(e) => updateForm("fte", e.target.value)} options={FTE_OPTIONS} border={theme.inputBorder} /></Field>
          <Field label="Years Experience" color={theme.muted}><TextInput value={form.yearsExperience} onChange={(e) => updateForm("yearsExperience", e.target.value)} type="number" border={theme.inputBorder} /></Field>
          <Field label="Education" color={theme.muted}><SelectInput value={form.educationLevel} onChange={(e) => updateForm("educationLevel", e.target.value)} options={settings.options.educationLevels} border={theme.inputBorder} /></Field>
          <Field label="Compensation Requested" color={theme.muted}><TextInput value={form.compensationRequested} onChange={(e) => updateForm("compensationRequested", e.target.value)} placeholder="Optional override" border={theme.inputBorder} /></Field>
          <Field label="Estimated Compensation" color={theme.muted}><TextInput value={estimatedComp} readOnly border={theme.inputBorder} /></Field>
          <Field label="Start Date" color={theme.muted}><SelectInput value={form.startAvailability} onChange={(e) => updateForm("startAvailability", e.target.value)} options={settings.options.startOptions} border={theme.inputBorder} /></Field>
          <Field label="Interview Availability" color={theme.muted}><TextInput value={form.interviewAvailability} onChange={(e) => updateForm("interviewAvailability", e.target.value)} border={theme.inputBorder} /></Field>
          <div style={{ gridColumn: "1 / -1" }}><Field label="Start Date Notes" color={theme.muted}><TextArea value={form.startNotes} onChange={(e) => updateForm("startNotes", e.target.value)} border={theme.inputBorder} /></Field></div>
          {isHealthcare ? <Field label="License Status" color={theme.muted}><SelectInput value={form.licenseStatus} onChange={(e) => updateForm("licenseStatus", e.target.value)} options={settings.options.licenseStatuses} border={theme.inputBorder} /></Field> : null}
          {isHealthcare ? <Field label="CPR Status" color={theme.muted}><SelectInput value={form.cprStatus} onChange={(e) => updateForm("cprStatus", e.target.value)} options={settings.options.cprStatuses} border={theme.inputBorder} /></Field> : null}
          {isHealthcare ? <Field label="Licensed Since" color={theme.muted}><TextInput value={form.licensedYear} onChange={(e) => updateForm("licensedYear", e.target.value)} border={theme.inputBorder} /></Field> : null}
          <div style={{ gridColumn: "1 / -1" }}><Field label="Experience Notes" color={theme.muted}><TextArea value={form.experienceNotes} onChange={(e) => updateForm("experienceNotes", e.target.value)} border={theme.inputBorder} /></Field></div>
        </div>
        <div style={{ marginTop: 20 }}><h3 style={{ margin: 0, color: theme.text }}>Work Expectations</h3><div style={{ ...fieldGrid, marginTop: 12 }}><Field label="Work Schedule" color={theme.muted}><TextInput value={form.workSchedule} onChange={(e) => updateForm("workSchedule", e.target.value)} border={theme.inputBorder} /></Field><Field label="Work Area" color={theme.muted}><TextInput value={form.workArea} onChange={(e) => updateForm("workArea", e.target.value)} border={theme.inputBorder} /></Field><Field label="OT" color={theme.muted}><SelectInput value={form.otRequirement} onChange={(e) => updateForm("otRequirement", e.target.value)} options={settings.options.otOptions} border={theme.inputBorder} /></Field><Field label="Weekend" color={theme.muted}><SelectInput value={form.weekendRequirement} onChange={(e) => updateForm("weekendRequirement", e.target.value)} options={settings.options.weekendOptions} border={theme.inputBorder} /></Field><Field label="On-Call" color={theme.muted}><SelectInput value={form.onCallRequirement} onChange={(e) => updateForm("onCallRequirement", e.target.value)} options={settings.options.onCallOptions} border={theme.inputBorder} /></Field></div><div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(2, minmax(0, 1fr))", marginTop: 12 }}><ToggleField label="Schedule Confirmed" checked={form.scheduleConfirmed} onChange={(v) => updateForm("scheduleConfirmed", v)} theme={theme} /><ToggleField label="OT Confirmed" checked={form.otConfirmed} onChange={(v) => updateForm("otConfirmed", v)} theme={theme} /><ToggleField label="Weekend Confirmed" checked={form.weekendConfirmed} onChange={(v) => updateForm("weekendConfirmed", v)} theme={theme} /><ToggleField label="On-Call Confirmed" checked={form.onCallConfirmed} onChange={(v) => updateForm("onCallConfirmed", v)} theme={theme} /></div></div>
        <div style={{ marginTop: 20 }}><Field label="Additional Notes" color={theme.muted}><TextArea value={form.candidateNotes} onChange={(e) => updateForm("candidateNotes", e.target.value)} border={theme.inputBorder} /></Field></div>
        <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}><Button primary onClick={generateOutput}>Generate Output</Button><Button onClick={submitCandidateFlow}>Submit Candidate Workflow</Button></div></Card>
      </div>
      <Card title="Generated Output" subtitle="Approve, send, log, confirm, remind, and age the submission." theme={theme}>{!output ? <div style={{ border: `1px dashed ${theme.cardBorder}`, borderRadius: 16, padding: 28, textAlign: "center", color: theme.muted }}>Generate output to preview submission content.</div> : <div style={{ display: "grid", gap: 22 }}><OutputBlock title="Subject" badge="Hiring Manager" value={output.hiringSubject} theme={theme} /><OutputBlock title="Hiring Manager Email" badge={getStrengthLabel()} value={output.hiringEmail} theme={theme} /><div style={{ display: "flex", justifyContent: "flex-end", marginTop: -14 }}><Button onClick={() => openEmail("hiring")}>Open in Outlook</Button></div><OutputBlock title="ATS Summary Block" badge="Operational" value={output.ats} theme={theme} /><OutputBlock title="Candidate Email" badge="Confirmation" value={output.candidateEmail} theme={theme} /><div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}><Button onClick={() => openEmail("candidate")}>Email Candidate</Button><Button primary onClick={submitCandidateFlow}>Approve + Execute Workflow</Button></div></div>}</Card>
    </div> : null}

    {activePage === "tracker" ? <Card title="Submission Tracker" subtitle="Control tower view: aging, owner, next action, risk, client response, and outcome." theme={theme}>{!tracker.length ? <div style={{ border: `1px dashed ${theme.cardBorder}`, borderRadius: 16, padding: 24, textAlign: "center", color: theme.muted }}>No tracked submissions yet.</div> : <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 10px", color: "#0f172a" }}><thead><tr>{["Candidate", "Role", "Facility", "Status", "Aging", "Risk", "Next Action", "Due", "Owner", "Feedback", "Outcome", "Reason"].map((h) => <th key={h} style={{ textAlign: "left", color: theme.muted, fontSize: 11, textTransform: "uppercase", padding: 8 }}>{h}</th>)}</tr></thead><tbody>{tracker.map((row) => { const risk = trackerRisk(row); const riskStyle = risk === "High" ? [theme.redBg, theme.redText] : risk === "Medium" ? [theme.goldBg, theme.goldText] : risk === "Closed" ? [theme.slateBg, theme.slateText] : [theme.greenBg, theme.greenText]; return <tr key={row.id} style={{ background: "#ffffff" }}><td style={{ padding: 8, borderRadius: "12px 0 0 12px" }}><strong>{row.candidate}</strong><div style={{ color: "#64748b", fontSize: 12 }}>{row.strength}</div></td><td style={{ padding: 8 }}>{row.position}</td><td style={{ padding: 8 }}>{row.facility}</td><td style={{ padding: 8 }}><SelectInput value={row.status} onChange={(e) => updateTracker(row.id, "status", e.target.value)} options={settings.options.trackerStatuses} border="#d7deea" /></td><td style={{ padding: 8 }}>{daysBetween(row.submittedDate)} days</td><td style={{ padding: 8 }}><Badge bg={riskStyle[0]} color={riskStyle[1]}>{risk}</Badge></td><td style={{ padding: 8 }}><TextInput value={row.nextAction} onChange={(e) => updateTracker(row.id, "nextAction", e.target.value)} border="#d7deea" /></td><td style={{ padding: 8 }}><TextInput type="date" value={row.dueDate} onChange={(e) => updateTracker(row.id, "dueDate", e.target.value)} border="#d7deea" /></td><td style={{ padding: 8 }}><TextInput value={row.recruiter} onChange={(e) => updateTracker(row.id, "recruiter", e.target.value)} border="#d7deea" /></td><td style={{ padding: 8 }}><TextInput value={row.clientFeedback} onChange={(e) => updateTracker(row.id, "clientFeedback", e.target.value)} border="#d7deea" /></td><td style={{ padding: 8 }}><SelectInput value={row.outcome} onChange={(e) => updateTracker(row.id, "outcome", e.target.value)} options={settings.options.outcomes} border="#d7deea" /></td><td style={{ padding: 8, borderRadius: "0 12px 12px 0" }}><TextInput value={row.reason} onChange={(e) => updateTracker(row.id, "reason", e.target.value)} border="#d7deea" /></td></tr>; })}</tbody></table></div>}</Card> : null}

    {activePage === "metrics" ? <div style={{ display: "grid", gap: 24 }}><div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>{[["Total Submissions", m.total], ["Submit → Interview", `${m.submitToInterview}%`], ["Interview → Offer", `${m.interviewToOffer}%`], ["Placement Rate", `${m.placementRate}%`], ["High Risk", m.highRisk]].map(([label, value]) => <Card key={label} title={String(value)} subtitle={label} theme={theme} />)}</div><Card title="Business Instrumentation" subtitle="Track whether automation is producing real recruiting value." theme={theme}><p style={{ margin: 0, color: theme.muted, lineHeight: 1.7 }}>Current build tracks submissions, outcomes, aging, and risk. Next deeper layer: time from screen to submit, submissions per job order, submit-to-interview ratio by role, interview-to-offer ratio by facility, and 30/60/90-day post-placement quality checks.</p></Card></div> : null}

    {activePage === "settings" ? <div style={{ display: "grid", gap: 24, gridTemplateColumns: "260px 1fr" }}><aside style={{ background: theme.sidebarBg, border: `1px solid ${theme.cardBorder}`, borderRadius: 20, padding: 16 }}><div style={{ marginBottom: 12, padding: 12, borderRadius: 14, background: theme.blueBg, color: theme.blueText, fontWeight: 700 }}>{BRAND.appName} Setup</div><div style={{ display: "grid", gap: 8 }}>{[["general", "Workspace Setup"], ["sites", "Sites"], ["roles", "Roles"], ["compensation", "Compensation Structure"], ["shifts", "Shifts + Core Options"], ["workflow", "Workflow Settings"], ["templates", "Templates"], ["imports", "Imports + Templates"]].map(([key, label]) => <NavButton key={key} active={activeSettingsTab === key} onClick={() => setActiveSettingsTab(key)}>{label}</NavButton>)}</div></aside><div style={{ display: "grid", gap: 24 }}>
      {activeSettingsTab === "general" ? <Card title="Workspace Setup" subtitle="Company, recruiter, and signature details." theme={theme}><div style={fieldGrid}>{Object.keys(settings.general).map((key) => <Field key={key} label={key.replace(/([A-Z])/g, " $1")} color={theme.muted}><TextInput value={settings.general[key]} onChange={(e) => updateSettings("general", key, e.target.value)} border={theme.inputBorder} /></Field>)}</div></Card> : null}
      {activeSettingsTab === "sites" ? <Card title="Sites" subtitle="Add facilities and upload site files here." theme={theme} action={<div style={{ display: "flex", gap: 8 }}><Button onClick={addSite}>Add Site</Button><Button onClick={() => openImport("sites")}>Upload Sites</Button></div>}><div style={{ display: "grid", gap: 16 }}>{settings.sites.map((site) => <div key={site.id} style={{ background: "#ffffff", color: "#0f172a", border: `1px solid ${theme.cardBorder}`, borderRadius: 16, padding: 16 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}><strong>Site Record</strong><Button onClick={() => removeFrom("sites", site.id)} style={{ color: "#b91c1c" }}>Delete</Button></div><div style={fieldGrid}>{["siteName", "siteType", "location", "facilityEmail", "status"].map((key) => <Field key={key} label={key} color={theme.muted}>{key === "status" ? <SelectInput value={site[key]} onChange={(e) => updateArray("sites", site.id, key, e.target.value)} options={["Active", "Inactive"]} border={theme.inputBorder} /> : <TextInput value={site[key] || ""} onChange={(e) => updateArray("sites", site.id, key, e.target.value)} border={theme.inputBorder} />}</Field>)}</div></div>)}</div></Card> : null}
      {activeSettingsTab === "roles" ? <><Card title="Role Category Options" subtitle="Editable dropdown source for Role Category." theme={theme}><TagEditor label="Role Categories" values={settings.options.roleTypes} onChange={(v) => updateOptions("roleTypes", v)} theme={theme} /></Card><Card title="Roles" subtitle="Keep Add Role here. No custom role action on Submission page." theme={theme} action={<div style={{ display: "flex", gap: 8 }}><Button onClick={addRole}>Add Role</Button><Button onClick={() => openImport("roles")}>Upload Roles</Button></div>}><div style={{ display: "grid", gap: 16 }}>{settings.roles.map((role) => <div key={role.id} style={{ background: "#ffffff", color: "#0f172a", border: `1px solid ${theme.cardBorder}`, borderRadius: 16, padding: 16 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}><strong>Role Record</strong><Button onClick={() => removeFrom("roles", role.id)} style={{ color: "#b91c1c" }}>Delete</Button></div><div style={fieldGrid}><Field label="Position Title" color={theme.muted}><TextInput value={role.positionTitle} onChange={(e) => updateArray("roles", role.id, "positionTitle", e.target.value)} border={theme.inputBorder} /></Field><Field label="Role Category" color={theme.muted}><SelectInput value={role.roleCategory} onChange={(e) => updateArray("roles", role.id, "roleCategory", e.target.value)} options={settings.options.roleTypes} border={theme.inputBorder} /></Field>{["requiresLicense", "requiresCpr", "requiresFte", "requiresShift", "requiresWorkExpectations"].map((key) => <ToggleField key={key} label={key} checked={role[key]} onChange={(v) => updateArray("roles", role.id, key, v)} theme={theme} />)}<Field label="Status" color={theme.muted}><SelectInput value={role.status} onChange={(e) => updateArray("roles", role.id, "status", e.target.value)} options={["Active", "Inactive"]} border={theme.inputBorder} /></Field></div></div>)}</div></Card></> : null}
      {activeSettingsTab === "compensation" ? <Card title="Compensation Structure" subtitle="Hourly/salary, years-based/flat/custom, shift differentials." theme={theme} action={<div style={{ display: "flex", gap: 8 }}><Button onClick={addRate}>Add Rule</Button><Button onClick={() => openImport("rates")}>Upload Rates</Button></div>}><div style={{ display: "grid", gap: 16 }}>{settings.compensationRules.map((rule) => <div key={rule.id} style={{ background: "#ffffff", color: "#0f172a", border: `1px solid ${theme.cardBorder}`, borderRadius: 16, padding: 16 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}><strong>Compensation Rule</strong><Button onClick={() => removeFrom("compensationRules", rule.id)} style={{ color: "#b91c1c" }}>Delete</Button></div><div style={fieldGrid}>{["positionTitle", "scopeType", "scopeValue", "compensationType", "basisType", "experienceTier", "baseAmount", "nightDiff", "weekendDiff", "eveningDiff"].map((key) => <Field key={key} label={key} color={theme.muted}><TextInput value={rule[key] || ""} onChange={(e) => updateArray("compensationRules", rule.id, key, e.target.value)} border={theme.inputBorder} /></Field>)}</div></div>)}</div></Card> : null}
      {activeSettingsTab === "shifts" ? <Card title="Shifts + Core Options" subtitle="Shift, work type, start options, and FTE display." theme={theme} action={<Button onClick={() => openImport("shifts")}>Upload Shifts</Button>}><div style={fieldGrid}><TagEditor label="Shift Options" values={settings.options.shiftOptions} onChange={(v) => updateOptions("shiftOptions", v)} theme={theme} /><TagEditor label="Work Types" values={settings.options.workTypes} onChange={(v) => updateOptions("workTypes", v)} theme={theme} /><TagEditor label="Start Options" values={settings.options.startOptions} onChange={(v) => updateOptions("startOptions", v)} theme={theme} /><div style={{ background: "#ffffff", color: "#0f172a", border: `1px solid ${theme.cardBorder}`, borderRadius: 16, padding: 16 }}><strong>FTE Display</strong><div style={{ display: "grid", gap: 8, marginTop: 10 }}>{FTE_OPTIONS.map((item) => <div key={item.value}>{item.label}</div>)}</div></div></div></Card> : null}
      {activeSettingsTab === "workflow" ? <Card title="Workflow Settings" subtitle="Customize approval, send, log, confirmation, reminders, and aging rules by company standard." theme={theme}><div style={fieldGrid}>{["requireApprovalBeforeSending", "openHiringEmail", "openCandidateEmail", "logToTracker", "setFollowUpReminder"].map((key) => <ToggleField key={key} label={key} checked={settings.workflow[key]} onChange={(v) => updateSettings("workflow", key, v)} theme={theme} />)}<Field label="Default Follow-Up Days" color={theme.muted}><TextInput type="number" value={settings.workflow.defaultFollowUpDays} onChange={(e) => updateSettings("workflow", "defaultFollowUpDays", e.target.value)} border={theme.inputBorder} /></Field><Field label="Medium Risk Days" color={theme.muted}><TextInput type="number" value={settings.workflow.mediumRiskDays} onChange={(e) => updateSettings("workflow", "mediumRiskDays", e.target.value)} border={theme.inputBorder} /></Field><Field label="High Risk Days" color={theme.muted}><TextInput type="number" value={settings.workflow.highRiskDays} onChange={(e) => updateSettings("workflow", "highRiskDays", e.target.value)} border={theme.inputBorder} /></Field><Field label="Auto Status After Submit" color={theme.muted}><SelectInput value={settings.workflow.autoStatusAfterSubmit} onChange={(e) => updateSettings("workflow", "autoStatusAfterSubmit", e.target.value)} options={settings.options.trackerStatuses} border={theme.inputBorder} /></Field></div></Card> : null}
      {activeSettingsTab === "templates" ? <Card title="Templates" subtitle="Customize generated email language." theme={theme}><div style={fieldGrid}>{Object.keys(settings.templates).map((key) => <div key={key} style={{ gridColumn: key.includes("candidate") || key.includes("Line") ? "1 / -1" : "auto" }}><Field label={key} color={theme.muted}><TextArea value={settings.templates[key]} onChange={(e) => updateSettings("templates", key, e.target.value)} border={theme.inputBorder} /></Field></div>)}</div></Card> : null}
      {activeSettingsTab === "imports" ? <><Card title="Downloadable Templates" subtitle="Uploads live on the page they feed into. This page is for templates and guidance." theme={theme}><div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}><Button onClick={() => downloadTemplate("sites")}>Sites Template</Button><Button onClick={() => downloadTemplate("roles")}>Roles Template</Button><Button onClick={() => downloadTemplate("rates")}>Rates Template</Button><Button onClick={() => downloadTemplate("shifts")}>Shifts Template</Button></div></Card><Card title="Upload Guidance" subtitle="Sites, Roles, Compensation, and Shifts each have their own upload button." theme={theme}><p style={{ margin: 0, color: theme.muted, lineHeight: 1.7 }}>Supported formats: PDF, DOCX, TXT, XLSX, CSV. Current build accepts files and routes the upload intent. Full parsing into live records is the next backend layer.</p></Card></> : null}
    </div></div> : null}

    <input ref={importInputRef} type="file" multiple style={{ display: "none" }} onChange={(e) => handleImport(e.target.files)} />
    <footer style={{ marginTop: 24, textAlign: "center", color: theme.muted, fontSize: 13 }}>{BRAND.footer}</footer>
  </div></div>;
}
