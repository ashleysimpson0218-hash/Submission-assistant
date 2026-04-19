import React, { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "welcomeflow-recruiting-assistant-v3-settings";
const RECENT_KEY = "welcomeflow-recruiting-assistant-v3-recent";
const TOUR_KEY = "welcomeflow-recruiting-assistant-v3-tour";

const BRAND = {
  appName: "WelcomeFlow: Recruiting Assistant",
  footer: "© Central 54 Holdings LLC",
  tagline: "A cleaner recruiting workflow, built to move faster.",
};

const THEMES = {
  corporate: {
    name: "Corporate Premium",
    pageBg: "linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)",
    cardBg: "rgba(255,255,255,0.96)",
    cardBorder: "#e2e8f0",
    text: "#0f172a",
    muted: "#64748b",
    primary: "#0f172a",
    secondary: "#1e3a8a",
    accent: "#2563eb",
    gold: "#d4af37",
    sidebarBg: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
    inputBorder: "#d7deea",
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
    primary: "#020617",
    secondary: "#2563eb",
    accent: "#38bdf8",
    gold: "#facc15",
    sidebarBg: "linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(2,6,23,0.98) 100%)",
    inputBorder: "#475569",
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
const SHIFT_OPTIONS = ["Day", "Night", "Evening", "Day or Night", "Evening or Night", "Any Shift"];
const START_OPTIONS = ["Immediate", "2–4 weeks", "4–6 weeks", "3 months", "6 months"];
const WORK_TYPES = ["On-site", "Remote", "Hybrid"];
const ROLE_TYPES = ["Healthcare", "Other"];
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
    educationLevels: ["High School", "Associate's", "Bachelor's", "Master's", "Doctorate", "Certification / Trade"],
    licenseStatusOptions: ["Active/Clear", "Active/Encumbered", "Inactive", "Pending", "Not Verified", "Not Required"],
    cprStatusOptions: ["Active", "Inactive", "Pending", "Not Required"],
    workExpectationOptions: {
      ot: ["None", "Occasional", "Required"],
      weekend: ["None", "Rotating", "Required"],
      onCall: ["None", "Occasional", "Required"],
    },
  },
  sites: [
    { id: "site-1", siteName: "Demo Facility", siteType: "24-hour", location: "Atlanta, GA", status: "Active", notes: "" },
  ],
  roles: [
    {
      id: "role-1",
      positionTitle: "Registered Nurse",
      roleCategory: "Healthcare",
      requiresLicense: true,
      requiresCpr: true,
      requiresFte: true,
      requiresShift: true,
      requiresWorkExpectations: true,
      status: "Active",
    },
    {
      id: "role-2",
      positionTitle: "Administrative Assistant",
      roleCategory: "Other",
      requiresLicense: false,
      requiresCpr: false,
      requiresFte: false,
      requiresShift: false,
      requiresWorkExpectations: true,
      status: "Active",
    },
  ],
  compensationStructure: {
    enabled: true,
    rules: [
      {
        id: "comp-1",
        positionTitle: "Registered Nurse",
        scopeType: "Site Type",
        scopeValue: "24-hour",
        compensationType: "Hourly",
        basisType: "Years-based",
        experienceTier: "3–5",
        baseAmount: "$42.25/hr",
        shiftDifferentialNight: "$2.00/hr",
        shiftDifferentialWeekend: "$1.50/hr",
        shiftDifferentialEvening: "$1.00/hr",
        customNotes: "",
      },
    ],
  },
  customFields: [
    { id: "cf-1", label: "Credential Notes", fieldType: "text", required: false, options: [], appliesTo: "candidate" },
  ],
  templates: {
    greetingLine: "Hello {facility},",
    introLine: "Please see candidate details below:",
    followUpLine: "Please review and advise next steps within 24–48 hours.",
    closingLine: "The candidate is aware of the hiring process and is prepared to move forward.",
    atsStyle: "Short",
    includeSubmissionDate: true,
    includeEducation: true,
    includeAvailability: true,
    includeCredentials: true,
    candidateEmailIntro: "Thank you for speaking with me today.",
    candidateEmailNextSteps: "Your information has been submitted for review.",
    candidateEmailTiming: "You can expect follow-up within 24–48 hours.",
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
  schoolName: "",
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
  candidateComments: "",
  candidateNotes: "",
  uploads: [],
  customFieldValues: {},
};

const DEMO_FORM = {
  ...DEFAULT_FORM,
  fullName: "Ashley Martin",
  phoneNumber: "404-555-0198",
  emailAddress: "ashleymartin@email.com",
  location: "Atlanta, GA",
  position: "Registered Nurse",
  roleCategory: "Healthcare",
  siteName: "Demo Facility",
  employmentType: "FT",
  shiftPreference: "Night",
  workType: "On-site",
  fte: "0.9",
  yearsExperience: "6",
  experienceNotes: "Corrections 3 yrs | Med-Surg 3 yrs | Strong communicator",
  educationLevel: "Bachelor's",
  fieldOfStudy: "Nursing",
  schoolName: "Chamberlain University",
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
  candidateComments: "Open to nights and long-term placement.",
  candidateNotes: "Responsive by text.",
  customFieldValues: { "cf-1": "Strong documentation habits" },
};

function makeId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function loadStoredValue(key, fallback) {
  try {
    if (typeof window === "undefined") return fallback;
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveStoredValue(key, value) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function tierFromYears(value) {
  const years = Number(value || 0);
  if (years <= 2) return "0–2";
  if (years <= 5) return "3–5";
  if (years <= 10) return "6–10";
  if (years <= 15) return "11–15";
  return "16+";
}

function todayString() {
  return new Date().toLocaleDateString("en-US");
}

function buildEducation(form) {
  const parts = [form.educationLevel, form.fieldOfStudy].filter(Boolean);
  return parts.length ? parts.join(" in ") : "N/A";
}

function badgeStyle(bg, color) {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    background: bg,
    color,
    fontSize: 10,
    fontWeight: 700,
    fontFamily: "Arial, sans-serif",
  };
}

function safeCopy(text) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
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
  return (
    <button
      type={type || "button"}
      onClick={onClick}
      style={{
        padding: "10px 14px",
        borderRadius: 12,
        border: primary ? "1px solid #0f172a" : "1px solid #d7deea",
        background: primary ? "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)" : "#ffffff",
        color: primary ? "#ffffff" : "#0f172a",
        fontWeight: 700,
        fontSize: 10,
        cursor: "pointer",
        fontFamily: "Arial, sans-serif",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function Field({ label, children, color }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ marginBottom: 6, fontSize: 10, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: 0.4, fontFamily: "Arial, sans-serif" }}>{label}</div>
      {children}
    </label>
  );
}

function TextInput({ value, onChange, placeholder, type, readOnly, border }) {
  return (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder || ""}
      type={type || "text"}
      readOnly={readOnly}
      style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: `1px solid ${border}`, boxSizing: "border-box", background: readOnly ? "#f8fafc" : "#ffffff", outline: "none", fontSize: 10, fontFamily: "Arial, sans-serif" }}
    />
  );
}

function SelectInput({ value, onChange, options, placeholder, border }) {
  return (
    <select value={value} onChange={onChange} style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: `1px solid ${border}`, boxSizing: "border-box", background: "#ffffff", outline: "none", fontSize: 10, fontFamily: "Arial, sans-serif" }}>
      <option value="">{placeholder || "Select"}</option>
      {options.map((option) => {
        const key = typeof option === "string" ? option : option.value;
        const label = typeof option === "string" ? option : option.label;
        return <option key={key} value={key}>{label}</option>;
      })}
    </select>
  );
}

function TextArea({ value, onChange, border }) {
  return (
    <textarea value={value} onChange={onChange} style={{ width: "100%", minHeight: 88, padding: "10px 12px", borderRadius: 12, border: `1px solid ${border}`, boxSizing: "border-box", resize: "vertical", background: "#ffffff", outline: "none", fontSize: 10, fontFamily: "Arial, sans-serif" }} />
  );
}

function Card({ title, subtitle, children, action, theme }) {
  return (
    <section style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}`, borderRadius: 20, padding: 22, boxShadow: "0 10px 26px rgba(15,23,42,0.06)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 18, alignItems: "flex-start" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: theme.text, fontFamily: "Arial, sans-serif" }}>{title}</h2>
          {subtitle ? <p style={{ margin: "6px 0 0 0", color: theme.muted, fontSize: 10, lineHeight: 1.5, fontFamily: "Arial, sans-serif" }}>{subtitle}</p> : null}
        </div>
        {action || null}
      </div>
      {children}
    </section>
  );
}

function ToggleField({ label, checked, onChange, theme }) {
  return (
    <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: `1px solid ${theme.cardBorder}`, borderRadius: 12, padding: 12, background: "#ffffff" }}>
      <span style={{ fontWeight: 700, fontSize: 10, color: theme.text, fontFamily: "Arial, sans-serif" }}>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function NavButton({ active, children, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{ width: "100%", textAlign: "left", padding: "11px 12px", borderRadius: 12, border: active ? "1px solid #1e3a8a" : "1px solid transparent", background: active ? "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)" : "transparent", color: active ? "#ffffff" : "#334155", fontWeight: 700, fontSize: 10, cursor: "pointer", fontFamily: "Arial, sans-serif" }}>
      {children}
    </button>
  );
}

function TagListEditor({ label, values, onChange, theme }) {
  const [draft, setDraft] = useState("");
  function addValue() {
    const clean = draft.trim();
    if (!clean || values.includes(clean)) return;
    onChange([...values, clean]);
    setDraft("");
  }
  return (
    <div style={{ border: `1px solid ${theme.cardBorder}`, borderRadius: 16, padding: 16, background: "#ffffff" }}>
      <div style={{ marginBottom: 10, fontSize: 10, fontWeight: 700, color: theme.text, fontFamily: "Arial, sans-serif" }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        {values.map((value) => (
          <span key={value} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 9px", borderRadius: 999, background: "#eef2ff", fontSize: 10, border: "1px solid #dbe4f0", fontFamily: "Arial, sans-serif" }}>
            {value}
            <button type="button" onClick={() => onChange(values.filter((item) => item !== value))} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#475569" }}>×</button>
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <TextInput value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add option" border={theme.inputBorder} />
        <Button onClick={addValue}>Add</Button>
      </div>
    </div>
  );
}

function CustomFieldEditor({ field, onUpdate, onRemove, theme }) {
  return (
    <div style={{ border: `1px solid ${theme.cardBorder}`, borderRadius: 16, padding: 16, background: "#ffffff" }}>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        <Field label="Label" color={theme.muted}>
          <TextInput value={field.label} onChange={(e) => onUpdate(field.id, "label", e.target.value)} border={theme.inputBorder} />
        </Field>
        <Field label="Field Type" color={theme.muted}>
          <SelectInput value={field.fieldType} onChange={(e) => onUpdate(field.id, "fieldType", e.target.value)} options={["text", "dropdown", "multi-select", "checkbox"]} border={theme.inputBorder} />
        </Field>
        <Field label="Applies To" color={theme.muted}>
          <SelectInput value={field.appliesTo} onChange={(e) => onUpdate(field.id, "appliesTo", e.target.value)} options={["candidate", "workspace"]} border={theme.inputBorder} />
        </Field>
        <ToggleField label="Required" checked={field.required} onChange={(value) => onUpdate(field.id, "required", value)} theme={theme} />
        {(field.fieldType === "dropdown" || field.fieldType === "multi-select") ? (
          <div style={{ gridColumn: "1 / -1" }}>
            <Field label="Options (comma separated)" color={theme.muted}>
              <TextInput value={field.options.join(", ")} onChange={(e) => onUpdate(field.id, "options", e.target.value.split(",").map((item) => item.trim()).filter(Boolean))} border={theme.inputBorder} />
            </Field>
          </div>
        ) : null}
      </div>
      <div style={{ marginTop: 12 }}>
        <Button onClick={() => onRemove(field.id)} style={{ borderColor: "#fecaca", color: "#b91c1c" }}>Remove Custom Field</Button>
      </div>
    </div>
  );
}

function FteLabel(value) {
  const match = FTE_OPTIONS.find((item) => item.value === value);
  return match ? match.label : value || "N/A";
}

export default function App() {
  const [activePage, setActivePage] = useState("submission");
  const [activeSettingsTab, setActiveSettingsTab] = useState("general");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [form, setForm] = useState(DEMO_FORM);
  const [recentCandidates, setRecentCandidates] = useState([DEMO_FORM]);
  const [output, setOutput] = useState(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [themeKey, setThemeKey] = useState("corporate");
  const [showTour, setShowTour] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const importInputRef = useRef(null);

  useEffect(() => {
    setSettings(loadStoredValue(STORAGE_KEY, DEFAULT_SETTINGS));
    setRecentCandidates(loadStoredValue(RECENT_KEY, [DEMO_FORM]));
    const savedTour = loadStoredValue(TOUR_KEY, { completed: false, theme: "corporate" });
    setThemeKey(savedTour.theme || "corporate");
    setShowTour(!savedTour.completed);
    setHasLoaded(true);
  }, []);

  useEffect(() => {
    if (!hasLoaded) return;
    saveStoredValue(STORAGE_KEY, settings);
  }, [settings, hasLoaded]);

  useEffect(() => {
    if (!hasLoaded) return;
    saveStoredValue(RECENT_KEY, recentCandidates);
  }, [recentCandidates, hasLoaded]);

  useEffect(() => {
    if (!hasLoaded) return;
    saveStoredValue(TOUR_KEY, { completed: !showTour, theme: themeKey });
  }, [showTour, themeKey, hasLoaded]);

  const theme = THEMES[themeKey] || THEMES.corporate;

  const setupProgress = useMemo(() => {
    const checks = {
      general: Boolean(settings.general.companyName || settings.general.recruiterName),
      sites: settings.sites.some((site) => site.siteName),
      roles: settings.roles.some((role) => role.positionTitle),
      compensation: !settings.compensationStructure.enabled || settings.compensationStructure.rules.some((rule) => rule.positionTitle && rule.baseAmount),
      templates: Boolean(settings.templates.greetingLine && settings.templates.introLine),
    };
    const complete = Object.values(checks).filter(Boolean).length;
    return { complete, total: 5, percent: Math.round((complete / 5) * 100) };
  }, [settings]);

  const activeRoles = useMemo(() => settings.roles.filter((role) => role.status === "Active"), [settings.roles]);
  const activeSites = useMemo(() => settings.sites.filter((site) => site.status === "Active"), [settings.sites]);
  const selectedRole = useMemo(() => activeRoles.find((role) => role.positionTitle === form.position) || null, [activeRoles, form.position]);
  const selectedSite = useMemo(() => activeSites.find((site) => site.siteName === form.siteName) || null, [activeSites, form.siteName]);
  const isHealthcare = (form.roleCategory || selectedRole?.roleCategory) === "Healthcare";

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
    const shiftKey = form.shiftPreference === "Night" ? match.shiftDifferentialNight : form.shiftPreference === "Evening" ? match.shiftDifferentialEvening : "";
    const weekendKey = form.weekendRequirement === "Required" || form.weekendRequirement === "Rotating" ? match.shiftDifferentialWeekend : "";
    const extras = [shiftKey, weekendKey].filter(Boolean).join(" + ");
    return extras ? `${match.baseAmount} (${extras})` : match.baseAmount;
  }, [settings.compensationStructure, form.position, form.yearsExperience, form.siteName, form.shiftPreference, form.weekendRequirement, selectedSite]);

  const settingsReady = Boolean(settings.general.companyName || settings.sites.length || settings.roles.length);

  const tourSteps = [
    { title: `Welcome to ${BRAND.appName}`, body: "Set up your workspace once, then your recruiters can move through submissions without touching code.", page: "settings", tab: "general", action: "Start Setup" },
    { title: "Step 1 — Workspace Setup", body: "Add company info, recruiter details, and email signature.", page: "settings", tab: "general", action: "Next" },
    { title: "Step 2 — Sites + Roles", body: "Add locations and roles, including custom roles and Healthcare vs Other logic.", page: "settings", tab: "roles", action: "Next" },
    { title: "Step 3 — Compensation Structure", body: "Set hourly or salary rules, years-based, flat, or custom, with shift differentials.", page: "settings", tab: "compensation", action: "Next" },
    { title: "Step 4 — Templates + Imports", body: "Customize output templates, create import templates, and understand manual vs upload setup.", page: "settings", tab: "imports", action: "Finish" },
  ];

  function goToTourStep(index) {
    const step = tourSteps[index];
    setTourStep(index);
    if (step.page) setActivePage(step.page);
    if (step.tab) setActiveSettingsTab(step.tab);
  }

  function updateForm(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateGeneral(key, value) {
    setSettings((prev) => ({ ...prev, general: { ...prev.general, [key]: value } }));
  }

  function updateTemplates(key, value) {
    setSettings((prev) => ({ ...prev, templates: { ...prev.templates, [key]: value } }));
  }

  function updateOptions(key, value) {
    setSettings((prev) => ({ ...prev, options: { ...prev.options, [key]: value } }));
  }

  function updateSite(id, key, value) {
    setSettings((prev) => ({ ...prev, sites: prev.sites.map((site) => (site.id === id ? { ...site, [key]: value } : site)) }));
  }

  function updateRole(id, key, value) {
    setSettings((prev) => ({ ...prev, roles: prev.roles.map((role) => (role.id === id ? { ...role, [key]: value } : role)) }));
  }

  function updateCompRule(id, key, value) {
    setSettings((prev) => ({ ...prev, compensationStructure: { ...prev.compensationStructure, rules: prev.compensationStructure.rules.map((rule) => (rule.id === id ? { ...rule, [key]: value } : rule)) } }));
  }

  function updateCustomField(id, key, value) {
    setSettings((prev) => ({ ...prev, customFields: prev.customFields.map((field) => (field.id === id ? { ...field, [key]: value } : field)) }));
  }

  function addSite() {
    setSettings((prev) => ({ ...prev, sites: [...prev.sites, { id: makeId("site"), siteName: "", siteType: "", location: "", status: "Active", notes: "" }] }));
  }

  function addRole() {
    setSettings((prev) => ({ ...prev, roles: [...prev.roles, { id: makeId("role"), positionTitle: "", roleCategory: "Other", requiresLicense: false, requiresCpr: false, requiresFte: false, requiresShift: false, requiresWorkExpectations: true, status: "Active" }] }));
  }

  function addCustomRole() {
    addRole();
    setActiveSettingsTab("roles");
  }

  function addCompRule() {
    setSettings((prev) => ({ ...prev, compensationStructure: { ...prev.compensationStructure, rules: [...prev.compensationStructure.rules, { id: makeId("comp"), positionTitle: "", scopeType: "Site Type", scopeValue: "", compensationType: "Hourly", basisType: "Years-based", experienceTier: "0–2", baseAmount: "", shiftDifferentialNight: "", shiftDifferentialWeekend: "", shiftDifferentialEvening: "", customNotes: "" }] } }));
  }

  function addCustomField() {
    setSettings((prev) => ({ ...prev, customFields: [...prev.customFields, { id: makeId("cf"), label: "", fieldType: "text", required: false, options: [], appliesTo: "candidate" }] }));
  }

  function removeSite(id) {
    setSettings((prev) => ({ ...prev, sites: prev.sites.filter((site) => site.id !== id) }));
  }

  function removeRole(id) {
    setSettings((prev) => ({ ...prev, roles: prev.roles.filter((role) => role.id !== id) }));
  }

  function removeCompRule(id) {
    setSettings((prev) => ({ ...prev, compensationStructure: { ...prev.compensationStructure, rules: prev.compensationStructure.rules.filter((rule) => rule.id !== id) } }));
  }

  function removeCustomField(id) {
    setSettings((prev) => ({ ...prev, customFields: prev.customFields.filter((field) => field.id !== id) }));
  }

  function handleImport(files, mode) {
    const incoming = Array.from(files || []);
    const unsupported = incoming.find((file) => {
      const ext = file.name.split(".").pop()?.toUpperCase();
      return !SUPPORTED_IMPORTS.includes(ext || "");
    });
    if (unsupported) {
      alert("Unsupported file format. Supported formats: PDF, Word, Text, Excel, and CSV.");
      return;
    }
    const uploads = incoming.map((file) => ({ name: file.name, mode, size: file.size }));
    setForm((prev) => ({ ...prev, uploads }));
  }

  function handleCustomFieldValue(field, rawValue) {
    setForm((prev) => ({ ...prev, customFieldValues: { ...prev.customFieldValues, [field.id]: rawValue } }));
  }

  function buildCredentials() {
    if (!isHealthcare) return "";
    const values = [];
    if (form.licenseStatus) values.push(`License: ${form.licenseStatus}`);
    if (form.cprStatus) values.push(`CPR: ${form.cprStatus}`);
    if (form.licensedYear) values.push(`Licensed Since: ${form.licensedYear}`);
    return values.join("\n");
  }

  function buildHiringManagerEmail(finalComp) {
    const facilityName = form.siteName || settings.general.companyName || "Hiring Team";
    const lines = [
      (settings.templates.greetingLine || "Hello {facility},").replace("{facility}", facilityName),
      "",
      settings.templates.introLine,
      "",
      "Candidate Summary:",
      `${form.fullName || "N/A"}`,
      `${form.phoneNumber || "N/A"} | ${form.emailAddress || "N/A"}`,
      `${form.location || "N/A"}`,
      settings.templates.includeSubmissionDate ? `Submission Date: ${todayString()}` : "",
      "",
      "Experience:",
      `${form.yearsExperience || "N/A"} years`,
      `${form.experienceNotes || "N/A"}`,
      "",
      "Compensation:",
      `${form.compensationType || "Hourly"} | ${finalComp}`,
      "",
      "Availability:",
      `Start: ${form.startAvailability || "N/A"}`,
      form.startNotes ? `Start Date Notes: ${form.startNotes}` : "",
      `Interview: ${form.interviewAvailability || "N/A"}`,
      "",
      "Work Expectations:",
      `Schedule: ${form.workSchedule || "N/A"}`,
      `OT: ${form.otRequirement || "N/A"}`,
      `Weekend: ${form.weekendRequirement || "N/A"}`,
      `On-Call: ${form.onCallRequirement || "N/A"}`,
      `Work Area: ${form.workArea || "N/A"}`,
      "",
      settings.templates.includeEducation ? `Education: ${buildEducation(form)}` : "",
      settings.templates.includeCredentials ? buildCredentials() : "",
      "",
      "Notes:",
      `${form.candidateNotes || "N/A"}`,
      `${form.candidateComments ? `Candidate Comments: ${form.candidateComments}` : ""}`,
      "",
      settings.templates.closingLine,
      settings.templates.followUpLine,
      "",
      settings.general.signOffName || settings.general.recruiterName || "",
      settings.general.signOffLine || "",
    ];
    return lines.filter(Boolean).join("\n");
  }

  function buildAtsShort(finalComp) {
    return [
      `${form.fullName || "N/A"} | ${form.position || "N/A"} | ${form.siteName || "N/A"}`,
      `${form.yearsExperience || "N/A"} yrs | ${finalComp}`,
      settings.templates.includeAvailability ? `Start ${form.startAvailability || "N/A"} | Interview ${form.interviewAvailability || "N/A"}` : "",
      `${form.workType || "N/A"} | ${FteLabel(form.fte)}`,
      form.candidateNotes || "N/A",
    ].filter(Boolean).join("\n");
  }

  function buildCandidateEmail(finalComp) {
    return [
      `Hello ${form.fullName || "Candidate"},`,
      "",
      settings.templates.candidateEmailIntro,
      "",
      `Role: ${form.position || "N/A"}`,
      `Location: ${form.siteName || "N/A"}`,
      `Work Type: ${form.workType || "N/A"}`,
      `Shift: ${form.shiftPreference || "N/A"}`,
      `Compensation Structure: ${form.compensationType || "Hourly"} | ${finalComp}`,
      "",
      settings.templates.candidateEmailNextSteps,
      settings.templates.candidateEmailTiming,
      "",
      settings.general.signOffName || settings.general.recruiterName || "",
      settings.general.signOffLine || "",
    ].filter(Boolean).join("\n");
  }

  function generateOutput() {
    const finalComp = form.compensationRequested || estimatedComp || "TBD";
    setOutput({
      submissionDate: todayString(),
      finalComp,
      hiringManagerEmail: buildHiringManagerEmail(finalComp),
      atsShort: buildAtsShort(finalComp),
      candidateEmail: buildCandidateEmail(finalComp),
    });
    setRecentCandidates((prev) => [form, ...prev.filter((item) => item.fullName !== form.fullName)].slice(0, 8));
  }

  function clearForm() {
    const confirmed = window.confirm("Are you sure you want to clear all fields?");
    if (!confirmed) return;
    setForm({ ...DEFAULT_FORM });
    setOutput(null);
  }



  function importSettings(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        setSettings(JSON.parse(String(reader.result)));
        setOutput(null);
        alert("Settings imported");
      } catch {
        alert("Import failed");
      }
    };
    reader.readAsText(file);
  }

  function downloadTemplate(kind) {
    const templates = {
      locations: "siteName,siteType,location,status,notes\nDemo Facility,24-hour,Atlanta GA,Active,",
      roles: "positionTitle,roleCategory,requiresLicense,requiresCpr,requiresFte,requiresShift,requiresWorkExpectations,status\nRegistered Nurse,Healthcare,true,true,true,true,true,Active",
      rateTables: "positionTitle,scopeType,scopeValue,compensationType,basisType,experienceTier,baseAmount,shiftDifferentialNight,shiftDifferentialWeekend,shiftDifferentialEvening,customNotes\nRegistered Nurse,Site Type,24-hour,Hourly,Years-based,3–5,$42.25/hr,$2.00/hr,$1.50/hr,$1.00/hr,",
      shifts: "shiftOption\nDay\nNight\nEvening\nDay or Night\nEvening or Night\nAny Shift",
      customFields: "label,fieldType,required,options,appliesTo\nCredential Notes,text,false,,candidate",
    };
    downloadTextFile(`${kind}-template.csv`, templates[kind] || "", "text/csv");
  }

  const pageStyle = { minHeight: "100vh", background: theme.pageBg, color: theme.text, fontFamily: "Arial, sans-serif", fontSize: 10 };
  const shellStyle = { maxWidth: 1320, margin: "0 auto", padding: 28 };
  const gridTwo = { display: "grid", gap: 24, gridTemplateColumns: "1.05fr 0.95fr", alignItems: "start" };

  const fieldGrid = { display: "grid", gap: 16, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" };

  return (
    <div style={pageStyle}>
      <div style={shellStyle}>
        <Card
          title={BRAND.appName}
          subtitle={BRAND.tagline}
          theme={theme}
          action={
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Button primary={activePage === "submission"} onClick={() => setActivePage("submission")}>✦ Submission</Button>
              <Button primary={activePage === "settings"} onClick={() => setActivePage("settings")}>⚙ Settings</Button>
            </div>
          }
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={badgeStyle(theme.badgeBlueBg, theme.badgeBlueText)}>{settingsReady ? "Workspace Ready" : "Setup Needed"}</span>
              <span style={badgeStyle(theme.badgeGreenBg, theme.badgeGreenText)}>{settings.compensationStructure.enabled ? "Compensation Active" : "Manual Compensation"}</span>
              <span style={badgeStyle(theme.badgeSlateBg, theme.badgeSlateText)}>{activeRoles.length} Active Roles</span>
              <span style={badgeStyle(theme.badgeGoldBg, theme.badgeGoldText)}>{activeSites.length} Active Sites</span>
            </div>
            <div style={{ minWidth: 180 }}>
              <SelectInput value={themeKey} onChange={(e) => setThemeKey(e.target.value)} options={[{ label: "Corporate Premium", value: "corporate" }, { label: "Dark Premium", value: "dark" }]} border={theme.inputBorder} />
            </div>
          </div>
        </Card>

        <div style={{ marginTop: 18, marginBottom: 24, background: theme.cardBg, border: `1px solid ${theme.cardBorder}`, borderRadius: 20, padding: 18 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: theme.muted, textTransform: "uppercase", letterSpacing: 0.4 }}>Setup Progress</div>
          <div style={{ marginTop: 8, height: 10, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ width: `${setupProgress.percent}%`, height: "100%", background: `linear-gradient(135deg, ${theme.secondary} 0%, ${theme.accent} 100%)` }} />
          </div>
          <div style={{ marginTop: 8, fontSize: 10, color: theme.muted }}>{setupProgress.complete} of {setupProgress.total} setup areas complete • {setupProgress.percent}% done</div>
          <div style={{ marginTop: 12 }}>
            <Button onClick={() => { setShowTour(true); setTourStep(0); goToTourStep(0); }}>Start Tutorial</Button>
          </div>
        </div>

        {showTour ? (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.58)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <div style={{ width: "100%", maxWidth: 620, background: theme.cardBg, border: `1px solid ${theme.cardBorder}`, borderRadius: 20, padding: 22 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: theme.muted }}>Guided Setup • Step {tourStep + 1} of {tourSteps.length}</div>
              <h2 style={{ margin: "10px 0 0 0", fontSize: 18 }}>{tourSteps[tourStep].title}</h2>
              <p style={{ marginTop: 12, color: theme.muted, lineHeight: 1.6 }}>{tourSteps[tourStep].body}</p>
              <div style={{ marginTop: 18, height: 10, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ width: `${((tourStep + 1) / tourSteps.length) * 100}%`, height: "100%", background: `linear-gradient(135deg, ${theme.secondary} 0%, ${theme.accent} 100%)` }} />
              </div>
              <div style={{ marginTop: 18, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 10 }}>
                  <Button onClick={() => { if (tourStep === 0) { setShowTour(false); return; } goToTourStep(Math.max(0, tourStep - 1)); }}>Back</Button>
                  <Button onClick={() => setShowTour(false)}>Skip</Button>
                </div>
                <Button primary onClick={() => { if (tourStep === tourSteps.length - 1) { setShowTour(false); setActivePage("submission"); return; } goToTourStep(tourStep + 1); }}>{tourSteps[tourStep].action}</Button>
              </div>
            </div>
          </div>
        ) : null}

        {activePage === "submission" ? (
          <div style={gridTwo}>
            <div style={{ display: "grid", gap: 24 }}>
              <Card title="Candidate Intake" subtitle="Professional intake flow with work expectations, custom fields, and clean outputs." theme={theme} action={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Button onClick={() => setForm(DEMO_FORM)}>Load Demo</Button><Button onClick={clearForm}>Clear Form</Button></div>}>
                <div style={fieldGrid}>
                  <Field label="Position" color={theme.muted}>
                    <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr auto" }}>
                      <SelectInput value={form.position} onChange={(e) => updateForm("position", e.target.value)} options={activeRoles.map((role) => role.positionTitle)} placeholder="Select role" border={theme.inputBorder} />
                      <Button onClick={addCustomRole}>Add Custom Role</Button>
                    </div>
                  </Field>
                  <Field label="Role Category" color={theme.muted}>
                    <SelectInput value={form.roleCategory || selectedRole?.roleCategory || ""} onChange={(e) => updateForm("roleCategory", e.target.value)} options={settings.options.roleTypes} placeholder="Healthcare or Other" border={theme.inputBorder} />
                  </Field>
                  <Field label="Full Name" color={theme.muted}><TextInput value={form.fullName} onChange={(e) => updateForm("fullName", e.target.value)} border={theme.inputBorder} /></Field>
                  <Field label="Phone Number" color={theme.muted}><TextInput value={form.phoneNumber} onChange={(e) => updateForm("phoneNumber", e.target.value)} border={theme.inputBorder} /></Field>
                  <Field label="Email Address" color={theme.muted}><TextInput value={form.emailAddress} onChange={(e) => updateForm("emailAddress", e.target.value)} border={theme.inputBorder} /></Field>
                  <Field label="Location" color={theme.muted}><TextInput value={form.location} onChange={(e) => updateForm("location", e.target.value)} border={theme.inputBorder} /></Field>
                  <Field label="Site / Facility" color={theme.muted}><SelectInput value={form.siteName} onChange={(e) => updateForm("siteName", e.target.value)} options={activeSites.map((site) => site.siteName)} placeholder="Select site" border={theme.inputBorder} /></Field>
                  <Field label="Employment Type" color={theme.muted}><SelectInput value={form.employmentType} onChange={(e) => updateForm("employmentType", e.target.value)} options={settings.options.employmentTypes} border={theme.inputBorder} /></Field>
                  <Field label="Shift Preference" color={theme.muted}><SelectInput value={form.shiftPreference} onChange={(e) => updateForm("shiftPreference", e.target.value)} options={settings.options.shiftOptions} border={theme.inputBorder} /></Field>
                  <Field label="Work Type" color={theme.muted}><SelectInput value={form.workType} onChange={(e) => updateForm("workType", e.target.value)} options={settings.options.workTypes} border={theme.inputBorder} /></Field>
                  <Field label="FTE" color={theme.muted}><SelectInput value={form.fte} onChange={(e) => updateForm("fte", e.target.value)} options={FTE_OPTIONS} border={theme.inputBorder} /></Field>
                  <Field label="Years of Experience" color={theme.muted}><TextInput value={form.yearsExperience} onChange={(e) => updateForm("yearsExperience", e.target.value)} type="number" border={theme.inputBorder} /></Field>
                  <Field label="Education" color={theme.muted}><SelectInput value={form.educationLevel} onChange={(e) => updateForm("educationLevel", e.target.value)} options={settings.options.educationLevels} border={theme.inputBorder} /></Field>
                  <Field label="Field of Study" color={theme.muted}><TextInput value={form.fieldOfStudy} onChange={(e) => updateForm("fieldOfStudy", e.target.value)} border={theme.inputBorder} /></Field>
                  <Field label="School" color={theme.muted}><TextInput value={form.schoolName} onChange={(e) => updateForm("schoolName", e.target.value)} border={theme.inputBorder} /></Field>
                  <Field label="Compensation Requested" color={theme.muted}><TextInput value={form.compensationRequested} onChange={(e) => updateForm("compensationRequested", e.target.value)} placeholder="Optional override" border={theme.inputBorder} /></Field>
                  <Field label="Compensation Type" color={theme.muted}><SelectInput value={form.compensationType} onChange={(e) => updateForm("compensationType", e.target.value)} options={COMP_TYPES} border={theme.inputBorder} /></Field>
                  <Field label="Estimated Compensation" color={theme.muted}><TextInput value={estimatedComp} readOnly border={theme.inputBorder} /></Field>
                  <Field label="Start Date" color={theme.muted}><SelectInput value={form.startAvailability} onChange={(e) => updateForm("startAvailability", e.target.value)} options={settings.options.startAvailabilityOptions} border={theme.inputBorder} /></Field>
                  <Field label="Interview Availability" color={theme.muted}><TextInput value={form.interviewAvailability} onChange={(e) => updateForm("interviewAvailability", e.target.value)} border={theme.inputBorder} /></Field>
                  <div style={{ gridColumn: "1 / -1" }}><Field label="Start Date Notes" color={theme.muted}><TextArea value={form.startNotes} onChange={(e) => updateForm("startNotes", e.target.value)} border={theme.inputBorder} /></Field></div>
                  {isHealthcare ? <Field label="License Status" color={theme.muted}><SelectInput value={form.licenseStatus} onChange={(e) => updateForm("licenseStatus", e.target.value)} options={settings.options.licenseStatusOptions} border={theme.inputBorder} /></Field> : null}
                  {isHealthcare ? <Field label="CPR Status" color={theme.muted}><SelectInput value={form.cprStatus} onChange={(e) => updateForm("cprStatus", e.target.value)} options={settings.options.cprStatusOptions} border={theme.inputBorder} /></Field> : null}
                  {isHealthcare ? <Field label="Licensed Year" color={theme.muted}><TextInput value={form.licensedYear} onChange={(e) => updateForm("licensedYear", e.target.value)} border={theme.inputBorder} /></Field> : null}
                  <div style={{ gridColumn: "1 / -1" }}><Field label="Experience Notes" color={theme.muted}><TextArea value={form.experienceNotes} onChange={(e) => updateForm("experienceNotes", e.target.value)} border={theme.inputBorder} /></Field></div>
                </div>

                <div style={{ marginTop: 20 }}>
                  <h3 style={{ margin: 0, fontSize: 12, color: theme.text }}>Position-Based Work Expectations</h3>
                  <div style={{ ...fieldGrid, marginTop: 12 }}>
                    <Field label="Work Schedule" color={theme.muted}><TextInput value={form.workSchedule} onChange={(e) => updateForm("workSchedule", e.target.value)} border={theme.inputBorder} /></Field>
                    <Field label="Work Area" color={theme.muted}><TextInput value={form.workArea} onChange={(e) => updateForm("workArea", e.target.value)} border={theme.inputBorder} /></Field>
                    <Field label="OT Requirement" color={theme.muted}><SelectInput value={form.otRequirement} onChange={(e) => updateForm("otRequirement", e.target.value)} options={settings.options.workExpectationOptions.ot} border={theme.inputBorder} /></Field>
                    <Field label="Weekend Requirement" color={theme.muted}><SelectInput value={form.weekendRequirement} onChange={(e) => updateForm("weekendRequirement", e.target.value)} options={settings.options.workExpectationOptions.weekend} border={theme.inputBorder} /></Field>
                    <Field label="On-Call Requirement" color={theme.muted}><SelectInput value={form.onCallRequirement} onChange={(e) => updateForm("onCallRequirement", e.target.value)} options={settings.options.workExpectationOptions.onCall} border={theme.inputBorder} /></Field>
                  </div>
                  <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(2, minmax(0, 1fr))", marginTop: 12 }}>
                    <ToggleField label="Schedule Confirmed" checked={form.scheduleConfirmed} onChange={(value) => updateForm("scheduleConfirmed", value)} theme={theme} />
                    <ToggleField label="OT Confirmed" checked={form.otConfirmed} onChange={(value) => updateForm("otConfirmed", value)} theme={theme} />
                    <ToggleField label="Weekend Confirmed" checked={form.weekendConfirmed} onChange={(value) => updateForm("weekendConfirmed", value)} theme={theme} />
                    <ToggleField label="On-Call Confirmed" checked={form.onCallConfirmed} onChange={(value) => updateForm("onCallConfirmed", value)} theme={theme} />
                  </div>
                </div>

                <div style={{ marginTop: 20 }}>
                  <h3 style={{ margin: 0, fontSize: 12, color: theme.text }}>Dynamic Custom Fields</h3>
                  <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
                    {settings.customFields.filter((field) => field.appliesTo === "candidate").map((field) => {
                      const value = form.customFieldValues[field.id];
                      return (
                        <Field key={field.id} label={field.label || "Custom Field"} color={theme.muted}>
                          {field.fieldType === "text" ? <TextInput value={value || ""} onChange={(e) => handleCustomFieldValue(field, e.target.value)} border={theme.inputBorder} /> : null}
                          {field.fieldType === "dropdown" ? <SelectInput value={value || ""} onChange={(e) => handleCustomFieldValue(field, e.target.value)} options={field.options} border={theme.inputBorder} /> : null}
                          {field.fieldType === "multi-select" ? <TextInput value={Array.isArray(value) ? value.join(", ") : ""} onChange={(e) => handleCustomFieldValue(field, e.target.value.split(",").map((item) => item.trim()).filter(Boolean))} placeholder="Comma separated selections" border={theme.inputBorder} /> : null}
                          {field.fieldType === "checkbox" ? <ToggleField label={field.label || "Checkbox"} checked={Boolean(value)} onChange={(checked) => handleCustomFieldValue(field, checked)} theme={theme} /> : null}
                        </Field>
                      );
                    })}
                  </div>
                </div>

                <div style={{ marginTop: 20, ...fieldGrid }}>
                  <div style={{ gridColumn: "1 / -1" }}><Field label="Candidate Comments" color={theme.muted}><TextArea value={form.candidateComments} onChange={(e) => updateForm("candidateComments", e.target.value)} border={theme.inputBorder} /></Field></div>
                  <div style={{ gridColumn: "1 / -1" }}><Field label="Candidate Notes" color={theme.muted}><TextArea value={form.candidateNotes} onChange={(e) => updateForm("candidateNotes", e.target.value)} border={theme.inputBorder} /></Field></div>
                </div>

                <div style={{ marginTop: 20 }}>
                  <h3 style={{ margin: 0, fontSize: 12, color: theme.text }}>Import Function</h3>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
                    <Button onClick={() => importInputRef.current?.click()}>Import Document</Button>
                    <Button onClick={() => importInputRef.current?.click()}>Import Spreadsheet/Data</Button>
                  </div>
                  <input ref={importInputRef} type="file" multiple style={{ display: "none" }} onChange={(e) => handleImport(e.target.files, "mixed")} />
                  <div style={{ marginTop: 8, fontSize: 10, color: theme.muted }}>Supported: PDF, DOCX, TXT, XLSX, CSV</div>
                  {form.uploads.length ? <div style={{ marginTop: 10, display: "grid", gap: 8 }}>{form.uploads.map((upload, index) => <div key={`${upload.name}-${index}`} style={{ fontSize: 10 }}>{upload.name} • {upload.mode}</div>)}</div> : null}
                </div>

                <div style={{ marginTop: 20, display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <Button primary onClick={generateOutput}>Generate Output</Button>
                </div>
              </Card>

              <Card title="Recent Candidates" subtitle="Reload recent candidate data quickly." theme={theme}>
                <div style={{ display: "grid", gap: 10 }}>
                  {recentCandidates.map((candidate, index) => (
                    <button key={`${candidate.fullName}-${index}`} type="button" onClick={() => setForm(candidate)} style={{ textAlign: "left", border: `1px solid ${theme.cardBorder}`, borderRadius: 14, padding: 12, background: "#ffffff", cursor: "pointer", fontFamily: "Arial, sans-serif" }}>
                      <div style={{ fontWeight: 700, fontSize: 10 }}>{candidate.fullName || "Unnamed Candidate"}</div>
                      <div style={{ marginTop: 4, fontSize: 10, color: theme.muted }}>{candidate.position || "No position"} • {candidate.siteName || "No site"}</div>
                    </button>
                  ))}
                </div>
              </Card>
            </div>

            <div style={{ display: "grid", gap: 24 }}>
              <Card title="Generated Output" subtitle="Professional hiring manager email, ATS short block, and candidate confirmation email." theme={theme} action={output ? <div style={badgeStyle(theme.badgeGreenBg, theme.badgeGreenText)}>Ready • {output.submissionDate}</div> : null}>
                {!output ? (
                  <div style={{ border: `1px dashed ${theme.cardBorder}`, borderRadius: 16, padding: 28, textAlign: "center", color: theme.muted, fontFamily: "Arial, sans-serif" }}>Fill the form, then click <strong>Generate Output</strong>.</div>
                ) : (
                  <div style={{ display: "grid", gap: 18 }}>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, gap: 10, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}><div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: theme.muted }}>Hiring Manager Email</div><span style={badgeStyle(theme.badgeBlueBg, theme.badgeBlueText)}>Professional Format</span></div>
                        <Button onClick={() => safeCopy(output.hiringManagerEmail)}>Copy</Button>
                      </div>
                      <pre style={{ margin: 0, whiteSpace: "pre-wrap", background: "#ffffff", border: `1px solid ${theme.cardBorder}`, borderRadius: 16, padding: 14, lineHeight: 1.6, fontFamily: "Arial, sans-serif", fontSize: 10 }}>{output.hiringManagerEmail}</pre>
                    </div>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, gap: 10, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}><div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: theme.muted }}>ATS Summary Block</div><span style={badgeStyle(theme.badgeGoldBg, theme.badgeGoldText)}>Short Version</span></div>
                        <Button onClick={() => safeCopy(output.atsShort)}>Copy</Button>
                      </div>
                      <pre style={{ margin: 0, whiteSpace: "pre-wrap", background: "#ffffff", border: `1px solid ${theme.cardBorder}`, borderRadius: 16, padding: 14, lineHeight: 1.6, fontFamily: "Arial, sans-serif", fontSize: 10 }}>{output.atsShort}</pre>
                    </div>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, gap: 10, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}><div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: theme.muted }}>Candidate Email</div><span style={badgeStyle(theme.badgeSlateBg, theme.badgeSlateText)}>Confirmation Option</span></div>
                        <Button onClick={() => safeCopy(output.candidateEmail)}>Copy</Button>
                      </div>
                      <pre style={{ margin: 0, whiteSpace: "pre-wrap", background: "#ffffff", border: `1px solid ${theme.cardBorder}`, borderRadius: 16, padding: 14, lineHeight: 1.6, fontFamily: "Arial, sans-serif", fontSize: 10 }}>{output.candidateEmail}</pre>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 24, gridTemplateColumns: "260px 1fr" }}>
            <aside style={{ background: theme.sidebarBg, border: `1px solid ${theme.cardBorder}`, borderRadius: 20, padding: 16 }}>
              <div style={{ marginBottom: 12, padding: 12, borderRadius: 14, background: `linear-gradient(135deg, ${theme.badgeBlueBg} 0%, ${theme.badgeSlateBg} 100%)`, color: theme.badgeBlueText, fontWeight: 700, fontSize: 10, fontFamily: "Arial, sans-serif" }}>{BRAND.appName} Setup</div>
              <div style={{ display: "grid", gap: 8 }}>
                {[
                  ["general", "✦ Workspace Setup"],
                  ["sites", "⌂ Sites"],
                  ["roles", "◈ Roles"],
                  ["compensation", "⚡ Compensation Structure"],
                  ["customFields", "☰ Custom Fields"],
                  ["templates", "✉ Templates"],
                  ["imports", "⬇ Imports + Templates"],
                ].map(([key, label]) => <NavButton key={key} active={activeSettingsTab === key} onClick={() => setActiveSettingsTab(key)}>{label}</NavButton>)}
              </div>
            </aside>

            <div style={{ display: "grid", gap: 24 }}>
              {activeSettingsTab === "general" ? (
                <>
                  <Card title="Workspace Setup" subtitle="This personalizes the app immediately." theme={theme}>
                    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                      <Field label="Workspace Name" color={theme.muted}><TextInput value={settings.general.workspaceName} onChange={(e) => updateGeneral("workspaceName", e.target.value)} border={theme.inputBorder} /></Field>
                      <Field label="Company Name" color={theme.muted}><TextInput value={settings.general.companyName} onChange={(e) => updateGeneral("companyName", e.target.value)} border={theme.inputBorder} /></Field>
                      <Field label="Recruiter Name" color={theme.muted}><TextInput value={settings.general.recruiterName} onChange={(e) => updateGeneral("recruiterName", e.target.value)} border={theme.inputBorder} /></Field>
                      <Field label="Recruiter Email" color={theme.muted}><TextInput value={settings.general.recruiterEmail} onChange={(e) => updateGeneral("recruiterEmail", e.target.value)} border={theme.inputBorder} /></Field>
                      <Field label="Recruiter Phone" color={theme.muted}><TextInput value={settings.general.recruiterPhone} onChange={(e) => updateGeneral("recruiterPhone", e.target.value)} border={theme.inputBorder} /></Field>
                      <Field label="Sign-Off Name" color={theme.muted}><TextInput value={settings.general.signOffName} onChange={(e) => updateGeneral("signOffName", e.target.value)} border={theme.inputBorder} /></Field>
                      <div style={{ gridColumn: "1 / -1" }}><Field label="Sign-Off Line" color={theme.muted}><TextArea value={settings.general.signOffLine} onChange={(e) => updateGeneral("signOffLine", e.target.value)} border={theme.inputBorder} /></Field></div>
                    </div>
                  </Card>
                  <Card title="Core Options" subtitle="Default role types, shifts, work types, start dates, and FTE display." theme={theme}>
                    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                      <TagListEditor label="Role Types" values={settings.options.roleTypes} onChange={(value) => updateOptions("roleTypes", value)} theme={theme} />
                      <TagListEditor label="Work Types" values={settings.options.workTypes} onChange={(value) => updateOptions("workTypes", value)} theme={theme} />
                      <TagListEditor label="Shift Preferences" values={settings.options.shiftOptions} onChange={(value) => updateOptions("shiftOptions", value)} theme={theme} />
                      <TagListEditor label="Start Date Options" values={settings.options.startAvailabilityOptions} onChange={(value) => updateOptions("startAvailabilityOptions", value)} theme={theme} />
                    </div>
                  </Card>
                </>
              ) : null}

              {activeSettingsTab === "sites" ? (
                <Card title="Sites / Locations" subtitle="Add locations and client/facility data." theme={theme} action={<Button onClick={addSite}>Add Site</Button>}>
                  <div style={{ display: "grid", gap: 16 }}>
                    {settings.sites.map((site) => (
                      <div key={site.id} style={{ border: `1px solid ${theme.cardBorder}`, borderRadius: 16, padding: 16, background: "#ffffff" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                          <div style={{ fontWeight: 700, fontSize: 10 }}>Site Record</div>
                          <Button onClick={() => removeSite(site.id)} style={{ borderColor: "#fecaca", color: "#b91c1c" }}>Delete</Button>
                        </div>
                        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                          <Field label="Site Name" color={theme.muted}><TextInput value={site.siteName} onChange={(e) => updateSite(site.id, "siteName", e.target.value)} border={theme.inputBorder} /></Field>
                          <Field label="Site Type" color={theme.muted}><TextInput value={site.siteType} onChange={(e) => updateSite(site.id, "siteType", e.target.value)} border={theme.inputBorder} /></Field>
                          <Field label="Location" color={theme.muted}><TextInput value={site.location} onChange={(e) => updateSite(site.id, "location", e.target.value)} border={theme.inputBorder} /></Field>
                          <Field label="Status" color={theme.muted}><SelectInput value={site.status} onChange={(e) => updateSite(site.id, "status", e.target.value)} options={["Active", "Inactive"]} border={theme.inputBorder} /></Field>
                          <div style={{ gridColumn: "1 / -1" }}><Field label="Notes" color={theme.muted}><TextArea value={site.notes} onChange={(e) => updateSite(site.id, "notes", e.target.value)} border={theme.inputBorder} /></Field></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              ) : null}

              {activeSettingsTab === "roles" ? (
                <Card title="Roles" subtitle="Use role category smart dropdown and add custom roles." theme={theme} action={<div style={{ display: "flex", gap: 8 }}><Button onClick={addRole}>Add Role</Button><Button onClick={addCustomRole}>Add Custom Role</Button></div>}>
                  <div style={{ display: "grid", gap: 16 }}>
                    {settings.roles.map((role) => (
                      <div key={role.id} style={{ border: `1px solid ${theme.cardBorder}`, borderRadius: 16, padding: 16, background: "#ffffff" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                          <div style={{ fontWeight: 700, fontSize: 10 }}>Role Record</div>
                          <Button onClick={() => removeRole(role.id)} style={{ borderColor: "#fecaca", color: "#b91c1c" }}>Delete</Button>
                        </div>
                        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                          <Field label="Position Title" color={theme.muted}><TextInput value={role.positionTitle} onChange={(e) => updateRole(role.id, "positionTitle", e.target.value)} border={theme.inputBorder} /></Field>
                          <Field label="Role Category" color={theme.muted}><SelectInput value={role.roleCategory} onChange={(e) => updateRole(role.id, "roleCategory", e.target.value)} options={settings.options.roleTypes} border={theme.inputBorder} /></Field>
                          <ToggleField label="Requires License" checked={role.requiresLicense} onChange={(value) => updateRole(role.id, "requiresLicense", value)} theme={theme} />
                          <ToggleField label="Requires CPR" checked={role.requiresCpr} onChange={(value) => updateRole(role.id, "requiresCpr", value)} theme={theme} />
                          <ToggleField label="Requires FTE" checked={role.requiresFte} onChange={(value) => updateRole(role.id, "requiresFte", value)} theme={theme} />
                          <ToggleField label="Requires Shift" checked={role.requiresShift} onChange={(value) => updateRole(role.id, "requiresShift", value)} theme={theme} />
                          <ToggleField label="Requires Work Expectations" checked={role.requiresWorkExpectations} onChange={(value) => updateRole(role.id, "requiresWorkExpectations", value)} theme={theme} />
                          <Field label="Status" color={theme.muted}><SelectInput value={role.status} onChange={(e) => updateRole(role.id, "status", e.target.value)} options={["Active", "Inactive"]} border={theme.inputBorder} /></Field>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              ) : null}

              {activeSettingsTab === "compensation" ? (
                <>
                  <Card title="Compensation Structure" subtitle="Hourly or salary, years-based, flat, or custom, with shift differentials." theme={theme} action={<Button onClick={addCompRule}>Add Rule</Button>}>
                    <div style={{ marginBottom: 16 }}>
                      <ToggleField label="Enable Compensation Structure" checked={settings.compensationStructure.enabled} onChange={(value) => setSettings((prev) => ({ ...prev, compensationStructure: { ...prev.compensationStructure, enabled: value } }))} theme={theme} />
                    </div>
                    <div style={{ display: "grid", gap: 16 }}>
                      {settings.compensationStructure.rules.map((rule) => (
                        <div key={rule.id} style={{ border: `1px solid ${theme.cardBorder}`, borderRadius: 16, padding: 16, background: "#ffffff" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                            <div style={{ fontWeight: 700, fontSize: 10 }}>Compensation Rule</div>
                            <Button onClick={() => removeCompRule(rule.id)} style={{ borderColor: "#fecaca", color: "#b91c1c" }}>Delete</Button>
                          </div>
                          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                            <Field label="Position" color={theme.muted}><SelectInput value={rule.positionTitle} onChange={(e) => updateCompRule(rule.id, "positionTitle", e.target.value)} options={settings.roles.map((role) => role.positionTitle).filter(Boolean)} border={theme.inputBorder} /></Field>
                            <Field label="Scope Type" color={theme.muted}><SelectInput value={rule.scopeType} onChange={(e) => updateCompRule(rule.id, "scopeType", e.target.value)} options={["Site Type", "Site"]} border={theme.inputBorder} /></Field>
                            <Field label={rule.scopeType === "Site Type" ? "Site Type" : "Site Name"} color={theme.muted}><SelectInput value={rule.scopeValue} onChange={(e) => updateCompRule(rule.id, "scopeValue", e.target.value)} options={rule.scopeType === "Site Type" ? [...new Set(settings.sites.map((site) => site.siteType).filter(Boolean))] : settings.sites.map((site) => site.siteName).filter(Boolean)} border={theme.inputBorder} /></Field>
                            <Field label="Compensation Type" color={theme.muted}><SelectInput value={rule.compensationType} onChange={(e) => updateCompRule(rule.id, "compensationType", e.target.value)} options={COMP_TYPES} border={theme.inputBorder} /></Field>
                            <Field label="Basis Type" color={theme.muted}><SelectInput value={rule.basisType} onChange={(e) => updateCompRule(rule.id, "basisType", e.target.value)} options={COMP_BASIS} border={theme.inputBorder} /></Field>
                            <Field label="Experience Tier" color={theme.muted}><SelectInput value={rule.experienceTier} onChange={(e) => updateCompRule(rule.id, "experienceTier", e.target.value)} options={["0–2", "3–5", "6–10", "11–15", "16+"]} border={theme.inputBorder} /></Field>
                            <Field label="Base Amount" color={theme.muted}><TextInput value={rule.baseAmount} onChange={(e) => updateCompRule(rule.id, "baseAmount", e.target.value)} border={theme.inputBorder} /></Field>
                            <Field label="Night Differential" color={theme.muted}><TextInput value={rule.shiftDifferentialNight} onChange={(e) => updateCompRule(rule.id, "shiftDifferentialNight", e.target.value)} border={theme.inputBorder} /></Field>
                            <Field label="Weekend Differential" color={theme.muted}><TextInput value={rule.shiftDifferentialWeekend} onChange={(e) => updateCompRule(rule.id, "shiftDifferentialWeekend", e.target.value)} border={theme.inputBorder} /></Field>
                            <Field label="Evening Differential" color={theme.muted}><TextInput value={rule.shiftDifferentialEvening} onChange={(e) => updateCompRule(rule.id, "shiftDifferentialEvening", e.target.value)} border={theme.inputBorder} /></Field>
                            <div style={{ gridColumn: "1 / -1" }}><Field label="Custom Notes" color={theme.muted}><TextArea value={rule.customNotes} onChange={(e) => updateCompRule(rule.id, "customNotes", e.target.value)} border={theme.inputBorder} /></Field></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                  <Card title="FTE Display" subtitle="FTE labels now display as weekly hours plus numeric FTE." theme={theme}>
                    <div style={{ display: "grid", gap: 8 }}>
                      {FTE_OPTIONS.map((item) => <div key={item.value} style={{ fontSize: 10 }}>{item.label}</div>)}
                    </div>
                  </Card>
                </>
              ) : null}

              {activeSettingsTab === "customFields" ? (
                <Card title="Dynamic Custom Fields" subtitle="Add text, dropdown, multi-select, and checkbox fields." theme={theme} action={<Button onClick={addCustomField}>Add Custom Field</Button>}>
                  <div style={{ display: "grid", gap: 16 }}>
                    {settings.customFields.map((field) => <CustomFieldEditor key={field.id} field={field} onUpdate={updateCustomField} onRemove={removeCustomField} theme={theme} />)}
                  </div>
                </Card>
              ) : null}

              {activeSettingsTab === "templates" ? (
                <>
                  <Card title="Hiring Manager Email" subtitle="Professional format with clean structured layout." theme={theme}>
                    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                      <Field label="Greeting Line" color={theme.muted}><TextInput value={settings.templates.greetingLine} onChange={(e) => updateTemplates("greetingLine", e.target.value)} border={theme.inputBorder} /></Field>
                      <Field label="Intro Line" color={theme.muted}><TextInput value={settings.templates.introLine} onChange={(e) => updateTemplates("introLine", e.target.value)} border={theme.inputBorder} /></Field>
                      <Field label="Follow-Up Line" color={theme.muted}><TextInput value={settings.templates.followUpLine} onChange={(e) => updateTemplates("followUpLine", e.target.value)} border={theme.inputBorder} /></Field>
                      <Field label="Closing Line" color={theme.muted}><TextInput value={settings.templates.closingLine} onChange={(e) => updateTemplates("closingLine", e.target.value)} border={theme.inputBorder} /></Field>
                    </div>
                  </Card>
                  <Card title="ATS Summary Block + Candidate Email" subtitle="Short ATS block and candidate confirmation email options." theme={theme}>
                    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                      <Field label="ATS Style" color={theme.muted}><SelectInput value={settings.templates.atsStyle} onChange={(e) => updateTemplates("atsStyle", e.target.value)} options={["Short", "Detailed"]} border={theme.inputBorder} /></Field>
                      <div />
                      <ToggleField label="Include Submission Date" checked={settings.templates.includeSubmissionDate} onChange={(value) => updateTemplates("includeSubmissionDate", value)} theme={theme} />
                      <ToggleField label="Include Education" checked={settings.templates.includeEducation} onChange={(value) => updateTemplates("includeEducation", value)} theme={theme} />
                      <ToggleField label="Include Availability" checked={settings.templates.includeAvailability} onChange={(value) => updateTemplates("includeAvailability", value)} theme={theme} />
                      <ToggleField label="Include Credentials" checked={settings.templates.includeCredentials} onChange={(value) => updateTemplates("includeCredentials", value)} theme={theme} />
                      <div style={{ gridColumn: "1 / -1" }}><Field label="Candidate Email Intro" color={theme.muted}><TextArea value={settings.templates.candidateEmailIntro} onChange={(e) => updateTemplates("candidateEmailIntro", e.target.value)} border={theme.inputBorder} /></Field></div>
                      <div style={{ gridColumn: "1 / -1" }}><Field label="Candidate Email Next Steps" color={theme.muted}><TextArea value={settings.templates.candidateEmailNextSteps} onChange={(e) => updateTemplates("candidateEmailNextSteps", e.target.value)} border={theme.inputBorder} /></Field></div>
                      <div style={{ gridColumn: "1 / -1" }}><Field label="Candidate Follow-Up Timing" color={theme.muted}><TextArea value={settings.templates.candidateEmailTiming} onChange={(e) => updateTemplates("candidateEmailTiming", e.target.value)} border={theme.inputBorder} /></Field></div>
                    </div>
                  </Card>
                </>
              ) : null}

              {activeSettingsTab === "imports" ? (
                <>
                  <Card title="Import Function" subtitle="Manual setup or upload setup, with downloadable templates." theme={theme}>
                    <div style={{ display: "grid", gap: 12 }}>
                      <div style={{ fontSize: 10, color: theme.muted }}>Supported formats: PDF, DOCX, TXT, XLSX, CSV</div>
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                        <Button onClick={() => importInputRef.current?.click()}>Import Document</Button>
                        <Button onClick={() => importInputRef.current?.click()}>Import Spreadsheet/Data</Button>
                        <label style={{ display: "inline-flex", alignItems: "center", padding: "10px 14px", borderRadius: 12, border: `1px solid ${theme.inputBorder}`, fontWeight: 700, cursor: "pointer", fontSize: 10 }}>
                          Import Saved Settings
                          <input type="file" accept="application/json" onChange={importSettings} style={{ display: "none" }} />
                        </label>
                      </div>
                      <div style={{ fontSize: 10, color: theme.muted }}>Bulk import includes: locations, rates, shifts, roles, requirements.</div>
                    </div>
                  </Card>
                  <Card title="Downloadable Templates" subtitle="Option A enabled: use downloadable templates for setup." theme={theme}>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <Button onClick={() => downloadTemplate("locations")}>Locations Template</Button>
                      <Button onClick={() => downloadTemplate("roles")}>Roles Template</Button>
                      <Button onClick={() => downloadTemplate("rateTables")}>Rate Tables Template</Button>
                      <Button onClick={() => downloadTemplate("shifts")}>Shift Details Template</Button>
                      <Button onClick={() => downloadTemplate("customFields")}>Custom Fields Template</Button>
                    </div>
                    <div style={{ marginTop: 16, fontSize: 10, color: theme.muted }}>
                      Tutorial: Use manual setup to enter records one by one, or use upload setup to bulk-load files and templates. Start with Workspace Setup, then Sites, Roles, Compensation Structure, Templates, and finally imports.
                    </div>
                  </Card>
                </>
              ) : null}
            </div>
          </div>
        )}

        <footer style={{ marginTop: 24, textAlign: "center", color: theme.muted, fontSize: 10, fontFamily: "Arial, sans-serif" }}>{BRAND.footer}</footer>
      </div>
    </div>
  );
}
