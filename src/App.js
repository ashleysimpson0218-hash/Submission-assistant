import React, { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "welcomeflow-recruiting-assistant-settings";
const RECENT_KEY = "welcomeflow-recruiting-assistant-recent";
const TOUR_KEY = "welcomeflow-recruiting-assistant-tour";

const BRAND = {
  parentCompany: "Central 54 Holdings",
  appName: "WelcomeFlow",
  productName: "Recruiting Assistant",
  tagline: "A cleaner recruiting workflow, built to move faster.",
};

const THEMES = {
  corporate: {
    name: "Corporate Premium",
    pageBg: "linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)",
    shellBg: "rgba(255,255,255,0.9)",
    cardBg: "rgba(255,255,255,0.92)",
    cardBorder: "rgba(226,232,240,0.95)",
    text: "#0f172a",
    muted: "#64748b",
    navPrimary: "#0f172a",
    navSecondary: "#1e3a8a",
    badgeBlueBg: "#dbeafe",
    badgeBlueText: "#1d4ed8",
    badgeGreenBg: "#d1fae5",
    badgeGreenText: "#047857",
    badgeSlateBg: "#f1f5f9",
    badgeSlateText: "#475569",
    badgeGoldBg: "#fef3c7",
    badgeGoldText: "#92400e",
    electric: "#2563eb",
    gold: "#d4af37",
    inputBorder: "#d7deea",
    sidebarBg: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  },
  dark: {
    name: "Dark Premium",
    pageBg: "linear-gradient(180deg, #020617 0%, #0f172a 100%)",
    shellBg: "rgba(15,23,42,0.85)",
    cardBg: "rgba(15,23,42,0.88)",
    cardBorder: "rgba(51,65,85,0.85)",
    text: "#f8fafc",
    muted: "#cbd5e1",
    navPrimary: "#0f172a",
    navSecondary: "#2563eb",
    badgeBlueBg: "#1e3a8a",
    badgeBlueText: "#dbeafe",
    badgeGreenBg: "#064e3b",
    badgeGreenText: "#d1fae5",
    badgeSlateBg: "#334155",
    badgeSlateText: "#e2e8f0",
    badgeGoldBg: "#78350f",
    badgeGoldText: "#fde68a",
    electric: "#38bdf8",
    gold: "#facc15",
    inputBorder: "#475569",
    sidebarBg: "linear-gradient(180deg, rgba(15,23,42,0.95) 0%, rgba(2,6,23,0.95) 100%)",
  },
  luxury: {
    name: "Soft Luxury",
    pageBg: "linear-gradient(180deg, #fffafc 0%, #f5f3ff 100%)",
    shellBg: "rgba(255,255,255,0.9)",
    cardBg: "rgba(255,255,255,0.94)",
    cardBorder: "rgba(233,213,255,0.8)",
    text: "#3b0764",
    muted: "#7c3aed",
    navPrimary: "#581c87",
    navSecondary: "#7c3aed",
    badgeBlueBg: "#ede9fe",
    badgeBlueText: "#5b21b6",
    badgeGreenBg: "#fdf2f8",
    badgeGreenText: "#9d174d",
    badgeSlateBg: "#f5f3ff",
    badgeSlateText: "#6d28d9",
    badgeGoldBg: "#fef3c7",
    badgeGoldText: "#92400e",
    electric: "#a855f7",
    gold: "#d4af37",
    inputBorder: "#ddd6fe",
    sidebarBg: "linear-gradient(180deg, #ffffff 0%, #faf5ff 100%)",
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
    employmentTypes: ["FT", "PT", "PRN", "Contract", "FT or PT"],
    shiftOptions: ["Day", "Evening", "Night", "Flexible", "PRN"],
    fteOptions: ["1.00", "0.90", "0.80", "0.60", "0.50", "0.40", "PRN"],
    startAvailabilityOptions: ["Immediate", "1–2 Weeks", "2–3 Weeks", "3+ Weeks"],
    educationLevels: [
      "High School",
      "Associate's",
      "Bachelor's",
      "Master's",
      "Doctorate",
      "Certification / Trade",
    ],
    licenseStatusOptions: [
      "Active/Clear",
      "Active/Encumbered",
      "Inactive",
      "Pending",
      "Not Verified",
      "Not Required",
    ],
    cprStatusOptions: ["Active", "Inactive", "Pending", "Not Required"],
  },
  sites: [
    {
      id: "site-1",
      siteName: "Demo Facility",
      siteType: "24-hour",
      location: "Atlanta, GA",
      status: "Active",
      notes: "",
    },
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
      status: "Active",
    },
    {
      id: "role-2",
      positionTitle: "Administrative Assistant",
      roleCategory: "General",
      requiresLicense: false,
      requiresCpr: false,
      requiresFte: false,
      requiresShift: false,
      status: "Active",
    },
  ],
  rates: {
    enabled: true,
    rules: [
      {
        id: "rate-1",
        positionTitle: "Registered Nurse",
        scopeType: "Site Type",
        scopeValue: "24-hour",
        experienceTier: "3–5",
        rate: "$42.25/hr",
        employmentType: "",
        shift: "",
      },
    ],
  },
  templates: {
    greetingLine: "Hello {facility},",
    introLine: "Please see candidate details below:",
    followUpLine: "Please reach out within 24–48 hours.",
    closingLine:
      "The candidate is aware of the hiring process and is prepared to move forward.",
    atsStyle: "Detailed",
    includeSubmissionDate: true,
    includeEducation: true,
    includeAvailability: true,
    includeCredentials: true,
  },
};

const DEMO_FORM = {
  fullName: "Ashley Martin",
  phoneNumber: "404-555-0198",
  emailAddress: "ashleymartin@email.com",
  location: "Atlanta, GA",
  position: "Registered Nurse",
  siteName: "Demo Facility",
  employmentType: "FT",
  shiftPreference: "Night",
  fte: "0.90",
  yearsExperience: "6",
  experienceNotes: "Corrections 3 yrs | Med-Surg 3 yrs | Strong communicator",
  educationLevel: "Bachelor's",
  fieldOfStudy: "Nursing",
  schoolName: "Chamberlain University",
  requestedRate: "",
  startAvailability: "2–3 Weeks",
  startNotes: "Needs to give two-week notice",
  interviewAvailability: "Mon–Fri after 4 PM",
  licenseStatus: "Active/Clear",
  cprStatus: "Active",
  licensedYear: "2019",
  candidateNotes:
    "Open to nights, interested in long-term placement, responsive by text.",
};

function makeId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function loadStoredValue(key, fallback) {
  try {
    if (typeof window === "undefined") return fallback;
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.error("Storage load failed", error);
    return fallback;
  }
}

function saveStoredValue(key, value) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error("Storage save failed", error);
  }
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

function downloadFile(name, content, type = "application/json") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function safeClipboardWrite(text) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return Promise.reject(new Error("Clipboard not available"));
}

function buildEducation(form) {
  const parts = [form.educationLevel, form.fieldOfStudy].filter(Boolean);
  return parts.length ? parts.join(" in ") : "N/A";
}

function Button({ children, onClick, primary = false, type = "button", style = {} }) {
  return (
    <button
      type={type}
      onClick={onClick}
      style={{
        padding: "12px 18px",
        borderRadius: 14,
        border: primary ? "1px solid #0f172a" : "1px solid #d7deea",
        background: primary
          ? "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)"
          : "rgba(255,255,255,0.92)",
        color: primary ? "#ffffff" : "#0f172a",
        fontWeight: 700,
        cursor: "pointer",
        boxShadow: primary
          ? "0 10px 24px rgba(30, 58, 138, 0.18)"
          : "0 4px 14px rgba(15, 23, 42, 0.05)",
        transition: "all 0.2s ease",
        backdropFilter: "blur(8px)",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function TextInput({ value, onChange, placeholder = "", type = "text", readOnly = false }) {
  return (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      type={type}
      readOnly={readOnly}
      style={{
        width: "100%",
        padding: "13px 14px",
        borderRadius: 14,
        border: "1px solid #d7deea",
        boxSizing: "border-box",
        background: readOnly ? "#f8fafc" : "rgba(255,255,255,0.96)",
        boxShadow: "inset 0 1px 2px rgba(15, 23, 42, 0.03)",
        outline: "none",
      }}
    />
  );
}

function SelectInput({ value, onChange, options, placeholder = "Select" }) {
  return (
    <select
      value={value}
      onChange={onChange}
      style={{
        width: "100%",
        padding: "13px 14px",
        borderRadius: 14,
        border: "1px solid #d7deea",
        boxSizing: "border-box",
        background: "rgba(255,255,255,0.96)",
        boxShadow: "inset 0 1px 2px rgba(15, 23, 42, 0.03)",
        outline: "none",
      }}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function TextArea({ value, onChange, placeholder = "" }) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{
        width: "100%",
        minHeight: 110,
        padding: "13px 14px",
        borderRadius: 14,
        border: "1px solid #d7deea",
        boxSizing: "border-box",
        resize: "vertical",
        background: "rgba(255,255,255,0.96)",
        boxShadow: "inset 0 1px 2px rgba(15, 23, 42, 0.03)",
        outline: "none",
      }}
    />
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "block" }}>
      <div
        style={{
          marginBottom: 8,
          fontSize: 12,
          fontWeight: 800,
          color: "#475569",
          letterSpacing: 0.5,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      {children}
    </label>
  );
}

function Card({ title, subtitle, children, action = null }) {
  return (
    <section
      style={{
        background: "rgba(255,255,255,0.9)",
        border: "1px solid rgba(226,232,240,0.95)",
        borderRadius: 24,
        padding: 26,
        boxShadow: "0 14px 36px rgba(15, 23, 42, 0.07)",
        backdropFilter: "blur(10px)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 20, alignItems: "flex-start" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, color: "#0f172a", letterSpacing: -0.4 }}>{title}</h2>
          {subtitle ? (
            <p style={{ margin: "8px 0 0 0", color: "#64748b", fontSize: 14, lineHeight: 1.55 }}>{subtitle}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ToggleField({ label, checked, onChange }) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        padding: 14,
        background: "rgba(255,255,255,0.96)",
      }}
    >
      <span style={{ fontWeight: 700, fontSize: 14, color: "#334155" }}>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
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
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 18,
        padding: 18,
        background: "rgba(255,255,255,0.96)",
        boxShadow: "0 4px 14px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 700, color: "#334155" }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {values.map((value) => (
          <span
            key={value}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 11px",
              borderRadius: 999,
              background: "linear-gradient(135deg, #eef2ff 0%, #f8fafc 100%)",
              fontSize: 12,
              border: "1px solid #dbe4f0",
            }}
          >
            {value}
            <button
              type="button"
              onClick={() => onChange(values.filter((item) => item !== value))}
              style={{ border: "none", background: "transparent", cursor: "pointer", color: "#475569" }}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <TextInput value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add option" />
        <Button onClick={addValue}>Add</Button>
      </div>
    </div>
  );
}

function NavButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "13px 14px",
        borderRadius: 14,
        border: active ? "1px solid #1e3a8a" : "1px solid transparent",
        background: active ? "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)" : "transparent",
        color: active ? "#ffffff" : "#334155",
        fontWeight: 700,
        cursor: "pointer",
        boxShadow: active ? "0 8px 20px rgba(30, 58, 138, 0.18)" : "none",
      }}
    >
      {children}
    </button>
  );
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
      rates: !settings.rates.enabled || settings.rates.rules.some((rule) => rule.positionTitle && rule.rate),
      templates: Boolean(settings.templates.greetingLine && settings.templates.introLine),
    };
    const complete = Object.values(checks).filter(Boolean).length;
    return { checks, complete, total: 5, percent: Math.round((complete / 5) * 100) };
  }, [settings]);

  const tourSteps = [
    {
      title: `Welcome to ${BRAND.appName} ${BRAND.productName}`,
      body: `Set up your workspace once, then your recruiters can move through submissions without touching code. ${BRAND.parentCompany} owns the business, but this product is branded as ${BRAND.appName}.`,
      action: "Start Setup",
    },
    {
      title: "Step 1 — Workspace Setup",
      body: "Add your company, recruiter details, and email signature. This controls how the app introduces you and closes emails.",
      tab: "general",
      page: "settings",
      action: "Go to General",
    },
    {
      title: "Step 2 — Add Sites",
      body: "Add every site, facility, or client you recruit for. These become selectable options on the submission page.",
      tab: "sites",
      page: "settings",
      action: "Go to Sites",
    },
    {
      title: "Step 3 — Add Roles",
      body: "Define positions and decide which fields appear. This is where healthcare roles can require license and CPR while general roles stay clean.",
      tab: "roles",
      page: "settings",
      action: "Go to Roles",
    },
    {
      title: "Step 4 — Configure the Rate Engine",
      body: "Turn automatic rate logic on if you want rates calculated by role, site type, and experience tier. Leave it off if you prefer manual entry.",
      tab: "rates",
      page: "settings",
      action: "Go to Rate Engine",
    },
    {
      title: "Step 5 — Customize Templates",
      body: "Adjust how your email and ATS note sound without breaking the structure. This keeps the tool flexible but controlled.",
      tab: "templates",
      page: "settings",
      action: "Go to Templates",
    },
    {
      title: "Step 6 — Theme + Tools",
      body: "Choose your theme, export your setup for teammates, or import a saved workspace. Then move into Candidate Intake and start generating submissions.",
      tab: "data",
      page: "settings",
      action: "Finish Setup",
    },
  ];

  function goToTourStep(index) {
    const step = tourSteps[index];
    setTourStep(index);
    if (step?.page) setActivePage(step.page);
    if (step?.tab) setActiveSettingsTab(step.tab);
  }

  const activeRoles = useMemo(
    () => settings.roles.filter((role) => role.status === "Active"),
    [settings.roles]
  );

  const activeSites = useMemo(
    () => settings.sites.filter((site) => site.status === "Active"),
    [settings.sites]
  );

  const selectedRole = useMemo(
    () => activeRoles.find((role) => role.positionTitle === form.position) || null,
    [activeRoles, form.position]
  );

  const selectedSite = useMemo(
    () => activeSites.find((site) => site.siteName === form.siteName) || null,
    [activeSites, form.siteName]
  );

  const isHealthcare = selectedRole?.roleCategory === "Healthcare";

  const estimatedRate = useMemo(() => {
    if (!settings.rates.enabled || !form.position) return "";
    const tier = tierFromYears(form.yearsExperience);
    const matchingRule = settings.rates.rules.find((rule) => {
      const positionMatch = rule.positionTitle === form.position;
      const tierMatch = rule.experienceTier === tier;
      const scopeMatch =
        rule.scopeType === "Site Type"
          ? rule.scopeValue === (selectedSite?.siteType || "")
          : rule.scopeValue === form.siteName;
      const employmentMatch = !rule.employmentType || rule.employmentType === form.employmentType;
      const shiftMatch = !rule.shift || rule.shift === form.shiftPreference;
      return positionMatch && tierMatch && scopeMatch && employmentMatch && shiftMatch;
    });
    return matchingRule?.rate || "";
  }, [settings.rates, form.position, form.yearsExperience, form.siteName, form.employmentType, form.shiftPreference, selectedSite]);

  const settingsReady = Boolean(
    settings.general.companyName || settings.sites.length || settings.roles.length
  );

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
    setSettings((prev) => ({
      ...prev,
      sites: prev.sites.map((site) => (site.id === id ? { ...site, [key]: value } : site)),
    }));
  }

  function updateRole(id, key, value) {
    setSettings((prev) => ({
      ...prev,
      roles: prev.roles.map((role) => (role.id === id ? { ...role, [key]: value } : role)),
    }));
  }

  function updateRateRule(id, key, value) {
    setSettings((prev) => ({
      ...prev,
      rates: {
        ...prev.rates,
        rules: prev.rates.rules.map((rule) => (rule.id === id ? { ...rule, [key]: value } : rule)),
      },
    }));
  }

  function addSite() {
    setSettings((prev) => ({
      ...prev,
      sites: [
        ...prev.sites,
        {
          id: makeId("site"),
          siteName: "",
          siteType: "",
          location: "",
          status: "Active",
          notes: "",
        },
      ],
    }));
  }

  function addRole() {
    setSettings((prev) => ({
      ...prev,
      roles: [
        ...prev.roles,
        {
          id: makeId("role"),
          positionTitle: "",
          roleCategory: "General",
          requiresLicense: false,
          requiresCpr: false,
          requiresFte: false,
          requiresShift: false,
          status: "Active",
        },
      ],
    }));
  }

  function addRateRule() {
    setSettings((prev) => ({
      ...prev,
      rates: {
        ...prev.rates,
        rules: [
          ...prev.rates.rules,
          {
            id: makeId("rate"),
            positionTitle: "",
            scopeType: "Site Type",
            scopeValue: "",
            experienceTier: "0–2",
            rate: "",
            employmentType: "",
            shift: "",
          },
        ],
      },
    }));
  }

  function removeSite(id) {
    setSettings((prev) => ({ ...prev, sites: prev.sites.filter((site) => site.id !== id) }));
  }

  function removeRole(id) {
    setSettings((prev) => ({ ...prev, roles: prev.roles.filter((role) => role.id !== id) }));
  }

  function removeRateRule(id) {
    setSettings((prev) => ({
      ...prev,
      rates: {
        ...prev.rates,
        rules: prev.rates.rules.filter((rule) => rule.id !== id),
      },
    }));
  }

  function buildCredentials() {
    if (!isHealthcare) return "";
    const values = [];
    if (form.licenseStatus) values.push(`License: ${form.licenseStatus}`);
    if (form.cprStatus) values.push(`CPR: ${form.cprStatus}`);
    if (form.licensedYear) values.push(`Licensed Since: ${form.licensedYear}`);
    return values.join("
");
  }

  function generateSubmission() {
    const submissionDate = todayString();
    const finalRate = form.requestedRate || estimatedRate || "TBD";
    const facilityName = form.siteName || settings.general.companyName || "Hiring Team";
    const greeting = (settings.templates.greetingLine || "Hello {facility},").replace(
      "{facility}",
      facilityName
    );

    const emailLines = [
      greeting,
      "",
      settings.templates.introLine || "Please see candidate details below:",
      "",
      "Candidate:",
      form.fullName || "N/A",
      `${form.phoneNumber || "N/A"} | ${form.emailAddress || "N/A"}`,
      form.location || "N/A",
    ];

    if (settings.templates.includeSubmissionDate) {
      emailLines.push(`Submitted: ${submissionDate}`);
    }

    emailLines.push(
      "",
      "Position Details:",
      `${form.position || "N/A"} | ${form.employmentType || "N/A"} | ${form.shiftPreference || "N/A"} | ${form.fte || "N/A"}`,
      "",
      "Experience:",
      form.yearsExperience || "N/A",
      form.experienceNotes || "N/A"
    );

    if (settings.templates.includeEducation) {
      emailLines.push("", "Education:", buildEducation(form));
    }

    emailLines.push("", "Compensation:", `Rate: ${finalRate}`);

    if (settings.templates.includeAvailability) {
      emailLines.push(
        "",
        "Availability:",
        `Start: ${form.startAvailability || "N/A"}`,
        form.startNotes ? `Start Notes: ${form.startNotes}` : "",
        `Interview: ${form.interviewAvailability || "N/A"}`
      );
    }

    if (settings.templates.includeCredentials && isHealthcare) {
      emailLines.push("", "Credentials:", buildCredentials() || "N/A");
    }

    emailLines.push(
      "",
      "Notes:",
      form.candidateNotes || "N/A",
      "",
      settings.templates.closingLine ||
        "The candidate is aware of the hiring process and is prepared to move forward.",
      "",
      settings.templates.followUpLine || "Please reach out within 24–48 hours.",
      "",
      settings.general.signOffName || settings.general.recruiterName || "",
      settings.general.signOffLine || ""
    );

    const detailedAts = [
      `Submitted ${form.fullName || "N/A"} for ${form.position || "N/A"} at ${facilityName}`,
      settings.templates.includeSubmissionDate ? `Date: ${submissionDate}` : "",
      `Exp: ${form.yearsExperience || "N/A"} | Rate: ${finalRate}`,
      settings.templates.includeAvailability
        ? `Avail: Start ${form.startAvailability || "N/A"} | Interview ${form.interviewAvailability || "N/A"}`
        : "",
      settings.templates.includeEducation ? `Edu: ${buildEducation(form)}` : "",
      settings.templates.includeCredentials && isHealthcare
        ? [
            form.licenseStatus ? `Lic: ${form.licenseStatus}` : "",
            form.cprStatus ? `CPR: ${form.cprStatus}` : "",
          ]
            .filter(Boolean)
            .join(" | ")
        : "",
      `Notes: ${form.candidateNotes || "N/A"}`,
    ]
      .filter(Boolean)
      .join("
");

    const compactAts = [
      `${form.fullName || "N/A"} | ${form.position || "N/A"} | ${facilityName}`,
      `${form.yearsExperience || "N/A"} yrs exp | ${finalRate}`,
      settings.templates.includeAvailability
        ? `Start ${form.startAvailability || "N/A"} | Interview ${form.interviewAvailability || "N/A"}`
        : "",
      settings.templates.includeEducation ? buildEducation(form) : "",
      settings.templates.includeCredentials && isHealthcare
        ? [form.licenseStatus || "", form.cprStatus ? `CPR ${form.cprStatus}` : ""]
            .filter(Boolean)
            .join(" | ")
        : "",
      form.candidateNotes || "N/A",
    ]
      .filter(Boolean)
      .join("
");

    setOutput({
      submissionDate,
      finalRate,
      emailBody: emailLines.filter((line) => line !== "").join("
"),
      atsNote: settings.templates.atsStyle === "Compact" ? compactAts : detailedAts,
    });

    setRecentCandidates((prev) => [form, ...prev.filter((item) => item.fullName !== form.fullName)].slice(0, 8));
  }

  function useDemoWorkspace() {
    setSettings(DEFAULT_SETTINGS);
    setForm(DEMO_FORM);
    setRecentCandidates([DEMO_FORM]);
    setOutput(null);
    setActivePage("submission");
  }

  function exportSettings() {
    downloadFile("submission-assistant-settings.json", JSON.stringify(settings, null, 2));
  }

  function importSettings(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        setSettings(parsed);
        setOutput(null);
        alert("Settings imported");
      } catch (error) {
        console.error(error);
        alert("Import failed");
      }
    };
    reader.readAsText(file);
  }

  const mailtoHref = output
    ? `mailto:?subject=${encodeURIComponent(
        `Candidate Submission: ${form.fullName || "Candidate"} | ${form.position || "Role"} | ${form.siteName || settings.general.companyName || "Company"}`
      )}&body=${encodeURIComponent(output.emailBody)}`
    : "#";

  const pageStyle = {
    minHeight: "100vh",
    background: theme.pageBg,
    color: theme.text,
    fontFamily: "Inter, Arial, sans-serif",
  };

  const shellStyle = {
    maxWidth: 1320,
    margin: "0 auto",
    padding: 28,
  };

  const gridTwo = {
    display: "grid",
    gap: 24,
    gridTemplateColumns: "1.08fr 0.92fr",
    alignItems: "start",
  };

  const settingsLayout = {
    display: "grid",
    gap: 24,
    gridTemplateColumns: "260px 1fr",
    alignItems: "start",
  };

  const fieldGrid = {
    display: "grid",
    gap: 18,
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  };

  return (
    <div style={pageStyle}>
      <div style={shellStyle}>
        <Card
          title={`${BRAND.appName} ${BRAND.productName}`}
          subtitle={BRAND.tagline}
          action={
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Button primary={activePage === "submission"} onClick={() => setActivePage("submission")}>
                ✦ Submission Assistant
              </Button>
              <Button primary={activePage === "settings"} onClick={() => setActivePage("settings")}>
                ⚙ Settings
              </Button>
            </div>
          }
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.6, textTransform: "uppercase", color: theme.muted }}>
                {BRAND.parentCompany}
              </div>
              <div style={{ marginTop: 6, fontSize: 14, color: theme.muted }}>
                {BRAND.appName} • {BRAND.productName}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <span style={badgeStyle(theme.badgeBlueBg, theme.badgeBlueText)}>{settingsReady ? "Workspace Ready" : "Setup Needed"}</span>
              <span style={badgeStyle(theme.badgeGreenBg, theme.badgeGreenText)}>{settings.rates.enabled ? "Auto Rate On" : "Manual Rate"}</span>
              <span style={badgeStyle(theme.badgeSlateBg, theme.badgeSlateText)}>{activeRoles.length} Active Roles</span>
              <span style={badgeStyle(theme.badgeGoldBg, theme.badgeGoldText)}>{activeSites.length} Active Sites</span>
            </div>
          </div>
        </Card>

        <div
          style={{
            marginTop: 18,
            marginBottom: 24,
            background: theme.cardBg,
            border: `1px solid ${theme.cardBorder}`,
            borderRadius: 20,
            padding: 18,
            boxShadow: "0 10px 28px rgba(15, 23, 42, 0.06)",
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div style={{ minWidth: 260, flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.3, textTransform: "uppercase", color: theme.muted }}>
              Setup Progress
            </div>
            <div style={{ marginTop: 8, height: 10, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" }}>
              <div
                style={{
                  width: `${setupProgress.percent}%`,
                  height: "100%",
                  background: `linear-gradient(135deg, ${theme.navSecondary} 0%, ${theme.electric} 100%)`,
                  borderRadius: 999,
                }}
              />
            </div>
            <div style={{ marginTop: 8, fontSize: 13, color: theme.muted }}>
              {setupProgress.complete} of {setupProgress.total} setup areas complete • {setupProgress.percent}% done
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ minWidth: 180 }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.3, textTransform: "uppercase", color: theme.muted, marginBottom: 6 }}>
                Theme
              </div>
              <select
                value={themeKey}
                onChange={(e) => setThemeKey(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: `1px solid ${theme.inputBorder}`,
                  background: "rgba(255,255,255,0.96)",
                }}
              >
                <option value="corporate">Corporate Premium</option>
                <option value="dark">Dark Premium</option>
                <option value="luxury">Soft Luxury</option>
              </select>
            </div>
            <Button onClick={() => { setShowTour(true); goToTourStep(0); }}>⟲ Start Tutorial</Button>
          </div>
        </div>

        {!settingsReady ? (
          <div style={{ marginTop: 24 }}>
            <Card
              title="Welcome"
              subtitle="No workspace setup found. Start with demo data or set up your workspace."
              action={
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <Button primary onClick={useDemoWorkspace}>Use Demo Workspace</Button>
                  <Button
                    onClick={() => {
                      setActivePage("settings");
                      setActiveSettingsTab("general");
                    }}
                  >
                    Set Up My Workspace
                  </Button>
                </div>
              }
            />
          </div>
        ) : null}

        {showTour ? (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15,23,42,0.58)",
              backdropFilter: "blur(6px)",
              zIndex: 1000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 640,
                background: theme.cardBg,
                border: `1px solid ${theme.cardBorder}`,
                borderRadius: 24,
                padding: 26,
                boxShadow: "0 24px 60px rgba(15,23,42,0.2)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "start" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.4, color: theme.muted }}>
                    Guided Setup • Step {tourStep + 1} of {tourSteps.length}
                  </div>
                  <h2 style={{ margin: "10px 0 0 0", fontSize: 28, color: theme.text }}>{tourSteps[tourStep].title}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTour(false)}
                  style={{ border: "none", background: "transparent", fontSize: 24, cursor: "pointer", color: theme.muted }}
                >
                  ×
                </button>
              </div>

              <p style={{ marginTop: 14, fontSize: 15, lineHeight: 1.7, color: theme.muted }}>
                {tourSteps[tourStep].body}
              </p>

              <div style={{ marginTop: 18, height: 10, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${((tourStep + 1) / tourSteps.length) * 100}%`,
                    height: "100%",
                    background: `linear-gradient(135deg, ${theme.navSecondary} 0%, ${theme.electric} 100%)`,
                  }}
                />
              </div>

              <div style={{ marginTop: 22, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Button
                    onClick={() => {
                      if (tourStep === 0) {
                        setShowTour(false);
                        return;
                      }
                      goToTourStep(Math.max(0, tourStep - 1));
                    }}
                  >
                    {tourStep === 0 ? "Close" : "Back"}
                  </Button>
                  <Button onClick={() => setShowTour(false)}>Skip Tour</Button>
                </div>

                <Button
                  primary
                  onClick={() => {
                    if (tourStep === tourSteps.length - 1) {
                      setShowTour(false);
                      setActivePage("submission");
                      return;
                    }
                    goToTourStep(tourStep + 1);
                  }}
                >
                  {tourStep === tourSteps.length - 1 ? "Go to Submission Page" : tourSteps[tourStep].action}
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        <div style={{ marginTop: 24 }}>
          {activePage === "submission" ? (
            <div style={gridTwo}>
              <div style={{ display: "grid", gap: 24 }}>
                <Card
                  title="Candidate Intake"
                  subtitle="Capture the essentials fast while on the call."
                  action={<Button onClick={() => setForm(DEMO_FORM)}>Load Demo Candidate</Button>}
                >
                  <div style={fieldGrid}>
                    <Field label="Full Name">
                      <TextInput value={form.fullName} onChange={(e) => updateForm("fullName", e.target.value)} />
                    </Field>
                    <Field label="Phone Number">
                      <TextInput value={form.phoneNumber} onChange={(e) => updateForm("phoneNumber", e.target.value)} />
                    </Field>
                    <Field label="Email Address">
                      <TextInput value={form.emailAddress} onChange={(e) => updateForm("emailAddress", e.target.value)} />
                    </Field>
                    <Field label="Current Location">
                      <TextInput value={form.location} onChange={(e) => updateForm("location", e.target.value)} placeholder="Atlanta, GA" />
                    </Field>
                    <Field label="Position">
                      <SelectInput
                        value={form.position}
                        onChange={(e) => updateForm("position", e.target.value)}
                        options={activeRoles.map((role) => role.positionTitle)}
                        placeholder="Select position"
                      />
                    </Field>
                    <Field label="Site / Facility">
                      <SelectInput
                        value={form.siteName}
                        onChange={(e) => updateForm("siteName", e.target.value)}
                        options={activeSites.map((site) => site.siteName)}
                        placeholder="Select site"
                      />
                    </Field>
                    <Field label="Employment Type">
                      <SelectInput
                        value={form.employmentType}
                        onChange={(e) => updateForm("employmentType", e.target.value)}
                        options={settings.options.employmentTypes}
                        placeholder="Select employment type"
                      />
                    </Field>
                    <Field label="Shift Preference">
                      <SelectInput
                        value={form.shiftPreference}
                        onChange={(e) => updateForm("shiftPreference", e.target.value)}
                        options={settings.options.shiftOptions}
                        placeholder="Select shift"
                      />
                    </Field>
                    <Field label="FTE">
                      <SelectInput
                        value={form.fte}
                        onChange={(e) => updateForm("fte", e.target.value)}
                        options={settings.options.fteOptions}
                        placeholder="Select FTE"
                      />
                    </Field>
                    <Field label="Years of Experience">
                      <TextInput
                        value={form.yearsExperience}
                        onChange={(e) => updateForm("yearsExperience", e.target.value)}
                        type="number"
                      />
                    </Field>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <Field label="Experience Notes">
                        <TextArea value={form.experienceNotes} onChange={(e) => updateForm("experienceNotes", e.target.value)} />
                      </Field>
                    </div>
                    <Field label="Highest Education">
                      <SelectInput
                        value={form.educationLevel}
                        onChange={(e) => updateForm("educationLevel", e.target.value)}
                        options={settings.options.educationLevels}
                        placeholder="Select education"
                      />
                    </Field>
                    <Field label="Field of Study">
                      <TextInput value={form.fieldOfStudy} onChange={(e) => updateForm("fieldOfStudy", e.target.value)} />
                    </Field>
                    <Field label="School (Optional)">
                      <TextInput value={form.schoolName} onChange={(e) => updateForm("schoolName", e.target.value)} />
                    </Field>
                    <Field label="Estimated Rate">
                      <TextInput value={estimatedRate} readOnly onChange={() => undefined} />
                    </Field>
                    <Field label="Requested Rate Override">
                      <TextInput
                        value={form.requestedRate}
                        onChange={(e) => updateForm("requestedRate", e.target.value)}
                        placeholder="Optional override"
                      />
                    </Field>
                    <Field label="Start Availability">
                      <SelectInput
                        value={form.startAvailability}
                        onChange={(e) => updateForm("startAvailability", e.target.value)}
                        options={settings.options.startAvailabilityOptions}
                        placeholder="Select start availability"
                      />
                    </Field>
                    <Field label="Interview Availability">
                      <TextInput
                        value={form.interviewAvailability}
                        onChange={(e) => updateForm("interviewAvailability", e.target.value)}
                        placeholder="Mon–Fri after 4 PM"
                      />
                    </Field>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <Field label="Start Notes">
                        <TextInput value={form.startNotes} onChange={(e) => updateForm("startNotes", e.target.value)} />
                      </Field>
                    </div>

                    {isHealthcare && selectedRole?.requiresLicense ? (
                      <Field label="License Status">
                        <SelectInput
                          value={form.licenseStatus}
                          onChange={(e) => updateForm("licenseStatus", e.target.value)}
                          options={settings.options.licenseStatusOptions}
                          placeholder="Select license status"
                        />
                      </Field>
                    ) : null}

                    {isHealthcare && selectedRole?.requiresCpr ? (
                      <Field label="CPR Status">
                        <SelectInput
                          value={form.cprStatus}
                          onChange={(e) => updateForm("cprStatus", e.target.value)}
                          options={settings.options.cprStatusOptions}
                          placeholder="Select CPR status"
                        />
                      </Field>
                    ) : null}

                    {isHealthcare && selectedRole?.requiresLicense ? (
                      <Field label="Licensed Year">
                        <TextInput
                          value={form.licensedYear}
                          onChange={(e) => updateForm("licensedYear", e.target.value)}
                          placeholder="2019"
                        />
                      </Field>
                    ) : null}

                    <div style={{ gridColumn: "1 / -1" }}>
                      <Field label="Candidate Notes">
                        <TextArea value={form.candidateNotes} onChange={(e) => updateForm("candidateNotes", e.target.value)} />
                      </Field>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 22 }}>
                    <Button primary onClick={generateSubmission}>Generate Submission</Button>
                    <Button onClick={() => setForm({ ...DEMO_FORM, position: "", siteName: "" })}>Clear Form</Button>
                  </div>
                </Card>

                <Card title="Recent Candidates" subtitle="Light memory only, so recruiters can reload and regenerate.">
                  <div style={{ display: "grid", gap: 12 }}>
                    {recentCandidates.map((candidate, index) => (
                      <button
                        key={`${candidate.fullName}-${index}`}
                        type="button"
                        onClick={() => setForm(candidate)}
                        style={{
                          textAlign: "left",
                          border: "1px solid #e2e8f0",
                          borderRadius: 18,
                          padding: 16,
                          background: "rgba(255,255,255,0.95)",
                          cursor: "pointer",
                          boxShadow: "0 4px 14px rgba(15, 23, 42, 0.04)",
                        }}
                      >
                        <div style={{ fontWeight: 700 }}>{candidate.fullName || "Unnamed Candidate"}</div>
                        <div style={{ marginTop: 6, fontSize: 14, color: "#64748b" }}>
                          {candidate.position || "No position"} • {candidate.siteName || "No site"}
                        </div>
                      </button>
                    ))}
                  </div>
                </Card>
              </div>

              <div style={{ display: "grid", gap: 24 }}>
                <Card
                  title="Submission Output"
                  subtitle="Your generated email and ATS note are ready to copy."
                  action={output ? <div style={badgeStyle("#d1fae5", "#047857")}>Ready to Copy • {output.submissionDate}</div> : null}
                >
                  {!output ? (
                    <div
                      style={{
                        border: "1px dashed #cbd5e1",
                        borderRadius: 18,
                        padding: 36,
                        textAlign: "center",
                        color: "#64748b",
                        background: "rgba(255,255,255,0.55)",
                      }}
                    >
                      Fill the form, then click <strong>Generate Submission</strong>.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 22 }}>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12, alignItems: "center" }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", color: "#64748b" }}>
                              Submission Email
                            </div>
                            <span style={badgeStyle("#e0e7ff", "#4338ca")}>Draft</span>
                          </div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <a
                              href={mailtoHref}
                              style={{
                                padding: "12px 16px",
                                borderRadius: 14,
                                background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
                                color: "#ffffff",
                                textDecoration: "none",
                                fontWeight: 700,
                                boxShadow: "0 10px 24px rgba(30, 58, 138, 0.18)",
                              }}
                            >
                              Open in Outlook
                            </a>
                            <Button onClick={() => safeClipboardWrite(output.emailBody).catch(() => alert("Copy failed"))}>
                              Copy Email
                            </Button>
                          </div>
                        </div>
                        <pre
                          style={{
                            margin: 0,
                            whiteSpace: "pre-wrap",
                            background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
                            border: "1px solid #e2e8f0",
                            borderRadius: 18,
                            padding: 18,
                            lineHeight: 1.65,
                            overflowX: "auto",
                            boxShadow: "inset 0 1px 2px rgba(15, 23, 42, 0.03)",
                          }}
                        >
                          {output.emailBody}
                        </pre>
                      </div>

                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12, alignItems: "center" }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", color: "#64748b" }}>
                              ATS Note
                            </div>
                            <span style={badgeStyle("#fef3c7", "#92400e")}>{settings.templates.atsStyle}</span>
                          </div>
                          <Button onClick={() => safeClipboardWrite(output.atsNote).catch(() => alert("Copy failed"))}>
                            Copy ATS Note
                          </Button>
                        </div>
                        <pre
                          style={{
                            margin: 0,
                            whiteSpace: "pre-wrap",
                            background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
                            border: "1px solid #e2e8f0",
                            borderRadius: 18,
                            padding: 18,
                            lineHeight: 1.65,
                            overflowX: "auto",
                            boxShadow: "inset 0 1px 2px rgba(15, 23, 42, 0.03)",
                          }}
                        >
                          {output.atsNote}
                        </pre>
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          ) : (
            <div style={settingsLayout}>
              <aside
                style={{
                  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
                  border: "1px solid #e2e8f0",
                  borderRadius: 24,
                  padding: 16,
                  height: "fit-content",
                  boxShadow: "0 14px 36px rgba(15, 23, 42, 0.07)",
                }}
              >
                <div
                  style={{
                    marginBottom: 12,
                    padding: 12,
                    borderRadius: 16,
                    background: `linear-gradient(135deg, ${theme.badgeBlueBg} 0%, ${theme.badgeSlateBg} 100%)`,
                    color: theme.badgeBlueText,
                    fontWeight: 800,
                    fontSize: 13,
                    letterSpacing: 0.3,
                  }}
                >
                  {BRAND.appName} Admin Panel
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {[
                    ["general", "✦ Workspace Setup"],
                    ["sites", "⌂ Sites"],
                    ["roles", "◈ Roles"],
                    ["rates", "⚡ Rate Engine"],
                    ["templates", "✉ Templates"],
                    ["data", "⬇ Workspace Tools"],
                  ].map(([key, label]) => (
                    <NavButton key={key} active={activeSettingsTab === key} onClick={() => setActiveSettingsTab(key)}>
                      {label}
                    </NavButton>
                  ))}
                </div>
              </aside>

              <div style={{ display: "grid", gap: 24 }}>
                {activeSettingsTab === "general" ? (
                  <>
                    <Card title="Workspace Setup" subtitle="This personalizes the product immediately without touching code.">
                      <div style={fieldGrid}>
                        <Field label="Workspace Name">
                          <TextInput value={settings.general.workspaceName} onChange={(e) => updateGeneral("workspaceName", e.target.value)} />
                        </Field>
                        <Field label="Company Name">
                          <TextInput value={settings.general.companyName} onChange={(e) => updateGeneral("companyName", e.target.value)} />
                        </Field>
                        <Field label="Recruiter Name">
                          <TextInput value={settings.general.recruiterName} onChange={(e) => updateGeneral("recruiterName", e.target.value)} />
                        </Field>
                        <Field label="Recruiter Email">
                          <TextInput value={settings.general.recruiterEmail} onChange={(e) => updateGeneral("recruiterEmail", e.target.value)} />
                        </Field>
                        <Field label="Recruiter Phone">
                          <TextInput value={settings.general.recruiterPhone} onChange={(e) => updateGeneral("recruiterPhone", e.target.value)} />
                        </Field>
                        <Field label="Sign-Off Name">
                          <TextInput value={settings.general.signOffName} onChange={(e) => updateGeneral("signOffName", e.target.value)} />
                        </Field>
                        <div style={{ gridColumn: "1 / -1" }}>
                          <Field label="Sign-Off Line">
                            <TextArea value={settings.general.signOffLine} onChange={(e) => updateGeneral("signOffLine", e.target.value)} />
                          </Field>
                        </div>
                      </div>
                    </Card>

                    <Card title="Dropdown Options" subtitle="Editable lists so buyers never need to change code.">
                      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                        <TagListEditor label="Employment Types" values={settings.options.employmentTypes} onChange={(value) => updateOptions("employmentTypes", value)} />
                        <TagListEditor label="Shift Options" values={settings.options.shiftOptions} onChange={(value) => updateOptions("shiftOptions", value)} />
                        <TagListEditor label="FTE Options" values={settings.options.fteOptions} onChange={(value) => updateOptions("fteOptions", value)} />
                        <TagListEditor label="Start Availability" values={settings.options.startAvailabilityOptions} onChange={(value) => updateOptions("startAvailabilityOptions", value)} />
                        <TagListEditor label="Education Levels" values={settings.options.educationLevels} onChange={(value) => updateOptions("educationLevels", value)} />
                        <TagListEditor label="License Status" values={settings.options.licenseStatusOptions} onChange={(value) => updateOptions("licenseStatusOptions", value)} />
                        <TagListEditor label="CPR Status" values={settings.options.cprStatusOptions} onChange={(value) => updateOptions("cprStatusOptions", value)} />
                      </div>
                    </Card>
                  </>
                ) : null}

                {activeSettingsTab === "sites" ? (
                  <Card title="Sites / Facilities" subtitle="Buyers add their own sites here. Nothing is hardcoded in the submission form." action={<Button onClick={addSite}>Add Site</Button>}>
                    <div style={{ display: "grid", gap: 16 }}>
                      {settings.sites.map((site) => (
                        <div key={site.id} style={{ border: "1px solid #e2e8f0", borderRadius: 18, padding: 18, background: "rgba(255,255,255,0.96)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>Site Record</div>
                            <button type="button" onClick={() => removeSite(site.id)} style={{ border: "none", background: "transparent", color: "#dc2626", fontWeight: 700, cursor: "pointer" }}>
                              Delete
                            </button>
                          </div>
                          <div style={fieldGrid}>
                            <Field label="Site Name">
                              <TextInput value={site.siteName} onChange={(e) => updateSite(site.id, "siteName", e.target.value)} />
                            </Field>
                            <Field label="Site Type">
                              <TextInput value={site.siteType} onChange={(e) => updateSite(site.id, "siteType", e.target.value)} placeholder="24-hour, Hospital, Corporate" />
                            </Field>
                            <Field label="Location">
                              <TextInput value={site.location} onChange={(e) => updateSite(site.id, "location", e.target.value)} />
                            </Field>
                            <Field label="Status">
                              <SelectInput value={site.status} onChange={(e) => updateSite(site.id, "status", e.target.value)} options={["Active", "Inactive"]} placeholder="Select status" />
                            </Field>
                            <div style={{ gridColumn: "1 / -1" }}>
                              <Field label="Notes">
                                <TextArea value={site.notes} onChange={(e) => updateSite(site.id, "notes", e.target.value)} />
                              </Field>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                ) : null}

                {activeSettingsTab === "roles" ? (
                  <Card title="Roles / Positions" subtitle="These records control which fields appear in the submission form." action={<Button onClick={addRole}>Add Role</Button>}>
                    <div style={{ display: "grid", gap: 16 }}>
                      {settings.roles.map((role) => (
                        <div key={role.id} style={{ border: "1px solid #e2e8f0", borderRadius: 18, padding: 18, background: "rgba(255,255,255,0.96)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>Role Record</div>
                            <button type="button" onClick={() => removeRole(role.id)} style={{ border: "none", background: "transparent", color: "#dc2626", fontWeight: 700, cursor: "pointer" }}>
                              Delete
                            </button>
                          </div>
                          <div style={fieldGrid}>
                            <Field label="Position Title">
                              <TextInput value={role.positionTitle} onChange={(e) => updateRole(role.id, "positionTitle", e.target.value)} />
                            </Field>
                            <Field label="Role Category">
                              <SelectInput value={role.roleCategory} onChange={(e) => updateRole(role.id, "roleCategory", e.target.value)} options={["Healthcare", "General"]} placeholder="Select role category" />
                            </Field>
                            <ToggleField label="Requires License" checked={role.requiresLicense} onChange={(value) => updateRole(role.id, "requiresLicense", value)} />
                            <ToggleField label="Requires CPR" checked={role.requiresCpr} onChange={(value) => updateRole(role.id, "requiresCpr", value)} />
                            <ToggleField label="Requires FTE" checked={role.requiresFte} onChange={(value) => updateRole(role.id, "requiresFte", value)} />
                            <ToggleField label="Requires Shift" checked={role.requiresShift} onChange={(value) => updateRole(role.id, "requiresShift", value)} />
                            <Field label="Status">
                              <SelectInput value={role.status} onChange={(e) => updateRole(role.id, "status", e.target.value)} options={["Active", "Inactive"]} placeholder="Select status" />
                            </Field>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                ) : null}

                {activeSettingsTab === "rates" ? (
                  <>
                    <Card title="Rate Engine" subtitle="Turn automatic rate logic on or off. If off, recruiters use manual rate only.">
                      <ToggleField label="Enable Automatic Rate Calculation" checked={settings.rates.enabled} onChange={(value) => setSettings((prev) => ({ ...prev, rates: { ...prev.rates, enabled: value } }))} />
                    </Card>

                    {settings.rates.enabled ? (
                      <Card title="Rate Rules" subtitle="Simple grid logic, not an Excel-looking mess." action={<Button onClick={addRateRule}>Add Rate Rule</Button>}>
                        <div style={{ display: "grid", gap: 16 }}>
                          {settings.rates.rules.map((rule) => (
                            <div key={rule.id} style={{ border: "1px solid #e2e8f0", borderRadius: 18, padding: 18, background: "rgba(255,255,255,0.96)" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                                <div style={{ fontWeight: 700, fontSize: 14 }}>Rate Rule</div>
                                <button type="button" onClick={() => removeRateRule(rule.id)} style={{ border: "none", background: "transparent", color: "#dc2626", fontWeight: 700, cursor: "pointer" }}>
                                  Delete
                                </button>
                              </div>
                              <div style={fieldGrid}>
                                <Field label="Position">
                                  <SelectInput value={rule.positionTitle} onChange={(e) => updateRateRule(rule.id, "positionTitle", e.target.value)} options={settings.roles.map((role) => role.positionTitle).filter(Boolean)} placeholder="Select role" />
                                </Field>
                                <Field label="Scope Type">
                                  <SelectInput value={rule.scopeType} onChange={(e) => updateRateRule(rule.id, "scopeType", e.target.value)} options={["Site Type", "Site"]} placeholder="Select scope type" />
                                </Field>
                                <Field label={rule.scopeType === "Site Type" ? "Site Type" : "Site Name"}>
                                  <SelectInput
                                    value={rule.scopeValue}
                                    onChange={(e) => updateRateRule(rule.id, "scopeValue", e.target.value)}
                                    options={
                                      rule.scopeType === "Site Type"
                                        ? [...new Set(settings.sites.map((site) => site.siteType).filter(Boolean))]
                                        : settings.sites.map((site) => site.siteName).filter(Boolean)
                                    }
                                    placeholder="Select value"
                                  />
                                </Field>
                                <Field label="Experience Tier">
                                  <SelectInput value={rule.experienceTier} onChange={(e) => updateRateRule(rule.id, "experienceTier", e.target.value)} options={["0–2", "3–5", "6–10", "11–15", "16+"]} placeholder="Select tier" />
                                </Field>
                                <Field label="Rate">
                                  <TextInput value={rule.rate} onChange={(e) => updateRateRule(rule.id, "rate", e.target.value)} placeholder="$42.25/hr" />
                                </Field>
                                <Field label="Employment Type (Optional)">
                                  <SelectInput value={rule.employmentType} onChange={(e) => updateRateRule(rule.id, "employmentType", e.target.value)} options={settings.options.employmentTypes} placeholder="Any" />
                                </Field>
                                <Field label="Shift (Optional)">
                                  <SelectInput value={rule.shift} onChange={(e) => updateRateRule(rule.id, "shift", e.target.value)} options={settings.options.shiftOptions} placeholder="Any" />
                                </Field>
                              </div>
                            </div>
                          ))}
                        </div>
                      </Card>
                    ) : (
                      <Card title="Manual Rate Only" subtitle="Automatic rate calculation is off. Recruiters can still enter a requested rate manually on the submission page." />
                    )}
                  </>
                ) : null}

                {activeSettingsTab === "templates" ? (
                  <>
                    <Card title="Email Template Settings" subtitle="Controlled text blocks so buyers can personalize wording without breaking structure.">
                      <div style={fieldGrid}>
                        <Field label="Greeting Line">
                          <TextInput value={settings.templates.greetingLine} onChange={(e) => updateTemplates("greetingLine", e.target.value)} />
                        </Field>
                        <Field label="Intro Line">
                          <TextInput value={settings.templates.introLine} onChange={(e) => updateTemplates("introLine", e.target.value)} />
                        </Field>
                        <Field label="Follow-Up Line">
                          <TextInput value={settings.templates.followUpLine} onChange={(e) => updateTemplates("followUpLine", e.target.value)} />
                        </Field>
                        <Field label="Closing Line">
                          <TextInput value={settings.templates.closingLine} onChange={(e) => updateTemplates("closingLine", e.target.value)} />
                        </Field>
                      </div>
                    </Card>

                    <Card title="ATS Template Settings" subtitle="Adjust output without breaking the underlying structure.">
                      <div style={fieldGrid}>
                        <Field label="ATS Style">
                          <SelectInput value={settings.templates.atsStyle} onChange={(e) => updateTemplates("atsStyle", e.target.value)} options={["Detailed", "Compact"]} placeholder="Select ATS style" />
                        </Field>
                        <div />
                        <ToggleField label="Include Submission Date" checked={settings.templates.includeSubmissionDate} onChange={(value) => updateTemplates("includeSubmissionDate", value)} />
                        <ToggleField label="Include Education" checked={settings.templates.includeEducation} onChange={(value) => updateTemplates("includeEducation", value)} />
                        <ToggleField label="Include Availability" checked={settings.templates.includeAvailability} onChange={(value) => updateTemplates("includeAvailability", value)} />
                        <ToggleField label="Include Credentials" checked={settings.templates.includeCredentials} onChange={(value) => updateTemplates("includeCredentials", value)} />
                      </div>
                    </Card>
                  </>
                ) : null}

                {activeSettingsTab === "data" ? (
                  <Card title="Workspace Tools" subtitle="Demo, reset, export, and import so buyers can manage their workspace cleanly.">
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <Button onClick={useDemoWorkspace}>Load Demo Workspace</Button>
                      <Button
                        onClick={() => {
                          setSettings({
                            ...DEFAULT_SETTINGS,
                            sites: [],
                            roles: [],
                            rates: { ...DEFAULT_SETTINGS.rates, rules: [] },
                          });
                          setOutput(null);
                          alert("Workspace reset");
                        }}
                        style={{ borderColor: "#fecaca", color: "#b91c1c" }}
                      >
                        Reset Workspace
                      </Button>
                      <Button onClick={exportSettings}>Export Settings</Button>
                      <label
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "12px 16px",
                          borderRadius: 14,
                          border: "1px solid #d7deea",
                          fontWeight: 700,
                          cursor: "pointer",
                          background: "rgba(255,255,255,0.96)",
                          boxShadow: "0 4px 14px rgba(15, 23, 42, 0.05)",
                        }}
                      >
                        Import Settings
                        <input type="file" accept="application/json" onChange={importSettings} style={{ display: "none" }} />
                      </label>
                    </div>
                  </Card>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function badgeStyle(bg, color) {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "7px 11px",
    borderRadius: 999,
    background: bg,
    color,
    fontSize: 12,
    fontWeight: 800,
  };
}

function TextInput({ value, onChange, placeholder = "", type = "text", readOnly = false }) {
  return (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      type={type}
      readOnly={readOnly}
      style={{
        width: "100%",
        padding: "13px 14px",
        borderRadius: 14,
        border: "1px solid #d7deea",
        boxSizing: "border-box",
        background: readOnly ? "#f8fafc" : "rgba(255,255,255,0.96)",
        boxShadow: "inset 0 1px 2px rgba(15, 23, 42, 0.03)",
        outline: "none",
      }}
    />
  );
}

function SelectInput({ value, onChange, options, placeholder = "Select" }) {
  return (
    <select
      value={value}
      onChange={onChange}
      style={{
        width: "100%",
        padding: "13px 14px",
        borderRadius: 14,
        border: "1px solid #d7deea",
        boxSizing: "border-box",
        background: "rgba(255,255,255,0.96)",
        boxShadow: "inset 0 1px 2px rgba(15, 23, 42, 0.03)",
        outline: "none",
      }}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function TextArea({ value, onChange, placeholder = "" }) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{
        width: "100%",
        minHeight: 110,
        padding: "13px 14px",
        borderRadius: 14,
        border: "1px solid #d7deea",
        boxSizing: "border-box",
        resize: "vertical",
        background: "rgba(255,255,255,0.96)",
        boxShadow: "inset 0 1px 2px rgba(15, 23, 42, 0.03)",
        outline: "none",
      }}
    />
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "block" }}>
      <div
        style={{
          marginBottom: 8,
          fontSize: 12,
          fontWeight: 800,
          color: "#475569",
          letterSpacing: 0.5,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      {children}
    </label>
  );
}

function Card({ title, subtitle, children, action = null }) {
  return (
    <section
      style={{
        background: "rgba(255,255,255,0.9)",
        border: "1px solid rgba(226,232,240,0.95)",
        borderRadius: 24,
        padding: 26,
        boxShadow: "0 14px 36px rgba(15, 23, 42, 0.07)",
        backdropFilter: "blur(10px)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 20, alignItems: "flex-start" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, color: "#0f172a", letterSpacing: -0.4 }}>{title}</h2>
          {subtitle ? (
            <p style={{ margin: "8px 0 0 0", color: "#64748b", fontSize: 14, lineHeight: 1.55 }}>{subtitle}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ToggleField({ label, checked, onChange }) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        padding: 14,
        background: "rgba(255,255,255,0.96)",
      }}
    >
      <span style={{ fontWeight: 700, fontSize: 14, color: "#334155" }}>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
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
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 18,
        padding: 18,
        background: "rgba(255,255,255,0.96)",
        boxShadow: "0 4px 14px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 700, color: "#334155" }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {values.map((value) => (
          <span
            key={value}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 11px",
              borderRadius: 999,
              background: "linear-gradient(135deg, #eef2ff 0%, #f8fafc 100%)",
              fontSize: 12,
              border: "1px solid #dbe4f0",
            }}
          >
            {value}
            <button
              type="button"
              onClick={() => onChange(values.filter((item) => item !== value))}
              style={{ border: "none", background: "transparent", cursor: "pointer", color: "#475569" }}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <TextInput value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add option" />
        <Button onClick={addValue}>Add</Button>
      </div>
    </div>
  );
}

function NavButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "13px 14px",
        borderRadius: 14,
        border: active ? "1px solid #1e3a8a" : "1px solid transparent",
        background: active ? "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)" : "transparent",
        color: active ? "#ffffff" : "#334155",
        fontWeight: 700,
        cursor: "pointer",
        boxShadow: active ? "0 8px 20px rgba(30, 58, 138, 0.18)" : "none",
      }}
    >
      {children}
    </button>
  );
}
({ value, onChange, placeholder = "", type = "text", readOnly = false }) {
  return (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      type={type}
      readOnly={readOnly}
      style={{
        width: "100%",
        padding: "12px 14px",
        borderRadius: 12,
        border: "1px solid #cbd5e1",
        boxSizing: "border-box",
        background: readOnly ? "#f8fafc" : "#ffffff",
      }}
    />
  );
}

function SelectInput({ value, onChange, options, placeholder = "Select" }) {
  return (
    <select
      value={value}
      onChange={onChange}
      style={{
        width: "100%",
        padding: "12px 14px",
        borderRadius: 12,
        border: "1px solid #cbd5e1",
        boxSizing: "border-box",
        background: "#ffffff",
      }}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function TextArea({ value, onChange, placeholder = "" }) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{
        width: "100%",
        minHeight: 100,
        padding: "12px 14px",
        borderRadius: 12,
        border: "1px solid #cbd5e1",
        boxSizing: "border-box",
        resize: "vertical",
        background: "#ffffff",
      }}
    />
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ marginBottom: 8, fontSize: 14, fontWeight: 700, color: "#334155" }}>
        {label}
      </div>
      {children}
    </label>
  );
}

function Card({ title, subtitle, children, action = null }) {
  return (
    <section
      style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: 20,
        padding: 24,
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, color: "#0f172a" }}>{title}</h2>
          {subtitle ? (
            <p style={{ margin: "8px 0 0 0", color: "#64748b", fontSize: 14 }}>{subtitle}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ToggleField({ label, checked, onChange }) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: 14,
        background: "#ffffff",
      }}
    >
      <span style={{ fontWeight: 700, fontSize: 14, color: "#334155" }}>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
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
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, background: "#ffffff" }}>
      <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 700, color: "#334155" }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {values.map((value) => (
          <span
            key={value}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 10px",
              borderRadius: 999,
              background: "#f1f5f9",
              fontSize: 12,
            }}
          >
            {value}
            <button
              type="button"
              onClick={() => onChange(values.filter((item) => item !== value))}
              style={{ border: "none", background: "transparent", cursor: "pointer", color: "#475569" }}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <TextInput value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add option" />
        <Button onClick={addValue}>Add</Button>
      </div>
    </div>
  );
}

function NavButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "12px 14px",
        borderRadius: 12,
        border: active ? "1px solid #0f172a" : "1px solid transparent",
        background: active ? "#0f172a" : "transparent",
        color: active ? "#ffffff" : "#334155",
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

export default function App() {
  const [activePage, setActivePage] = useState("submission");
  const [activeSettingsTab, setActiveSettingsTab] = useState("general");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [form, setForm] = useState(DEMO_FORM);
  const [recentCandidates, setRecentCandidates] = useState([DEMO_FORM]);
  const [output, setOutput] = useState(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    setSettings(loadStoredValue(STORAGE_KEY, DEFAULT_SETTINGS));
    setRecentCandidates(loadStoredValue(RECENT_KEY, [DEMO_FORM]));
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

  const activeRoles = useMemo(
    () => settings.roles.filter((role) => role.status === "Active"),
    [settings.roles]
  );

  const activeSites = useMemo(
    () => settings.sites.filter((site) => site.status === "Active"),
    [settings.sites]
  );

  const selectedRole = useMemo(
    () => activeRoles.find((role) => role.positionTitle === form.position) || null,
    [activeRoles, form.position]
  );

  const selectedSite = useMemo(
    () => activeSites.find((site) => site.siteName === form.siteName) || null,
    [activeSites, form.siteName]
  );

  const isHealthcare = selectedRole?.roleCategory === "Healthcare";

  const estimatedRate = useMemo(() => {
    if (!settings.rates.enabled || !form.position) return "";
    const tier = tierFromYears(form.yearsExperience);
    const matchingRule = settings.rates.rules.find((rule) => {
      const positionMatch = rule.positionTitle === form.position;
      const tierMatch = rule.experienceTier === tier;
      const scopeMatch =
        rule.scopeType === "Site Type"
          ? rule.scopeValue === (selectedSite?.siteType || "")
          : rule.scopeValue === form.siteName;
      const employmentMatch = !rule.employmentType || rule.employmentType === form.employmentType;
      const shiftMatch = !rule.shift || rule.shift === form.shiftPreference;
      return positionMatch && tierMatch && scopeMatch && employmentMatch && shiftMatch;
    });
    return matchingRule?.rate || "";
  }, [settings.rates, form.position, form.yearsExperience, form.siteName, form.employmentType, form.shiftPreference, selectedSite]);

  const settingsReady = Boolean(
    settings.general.companyName || settings.sites.length || settings.roles.length
  );

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
    setSettings((prev) => ({
      ...prev,
      sites: prev.sites.map((site) => (site.id === id ? { ...site, [key]: value } : site)),
    }));
  }

  function updateRole(id, key, value) {
    setSettings((prev) => ({
      ...prev,
      roles: prev.roles.map((role) => (role.id === id ? { ...role, [key]: value } : role)),
    }));
  }

  function updateRateRule(id, key, value) {
    setSettings((prev) => ({
      ...prev,
      rates: {
        ...prev.rates,
        rules: prev.rates.rules.map((rule) => (rule.id === id ? { ...rule, [key]: value } : rule)),
      },
    }));
  }

  function addSite() {
    setSettings((prev) => ({
      ...prev,
      sites: [
        ...prev.sites,
        {
          id: makeId("site"),
          siteName: "",
          siteType: "",
          location: "",
          status: "Active",
          notes: "",
        },
      ],
    }));
  }

  function addRole() {
    setSettings((prev) => ({
      ...prev,
      roles: [
        ...prev.roles,
        {
          id: makeId("role"),
          positionTitle: "",
          roleCategory: "General",
          requiresLicense: false,
          requiresCpr: false,
          requiresFte: false,
          requiresShift: false,
          status: "Active",
        },
      ],
    }));
  }

  function addRateRule() {
    setSettings((prev) => ({
      ...prev,
      rates: {
        ...prev.rates,
        rules: [
          ...prev.rates.rules,
          {
            id: makeId("rate"),
            positionTitle: "",
            scopeType: "Site Type",
            scopeValue: "",
            experienceTier: "0–2",
            rate: "",
            employmentType: "",
            shift: "",
          },
        ],
      },
    }));
  }

  function removeSite(id) {
    setSettings((prev) => ({ ...prev, sites: prev.sites.filter((site) => site.id !== id) }));
  }

  function removeRole(id) {
    setSettings((prev) => ({ ...prev, roles: prev.roles.filter((role) => role.id !== id) }));
  }

  function removeRateRule(id) {
    setSettings((prev) => ({
      ...prev,
      rates: {
        ...prev.rates,
        rules: prev.rates.rules.filter((rule) => rule.id !== id),
      },
    }));
  }

  function buildCredentials() {
    if (!isHealthcare) return "";
    const values = [];
    if (form.licenseStatus) values.push(`License: ${form.licenseStatus}`);
    if (form.cprStatus) values.push(`CPR: ${form.cprStatus}`);
    if (form.licensedYear) values.push(`Licensed Since: ${form.licensedYear}`);
    return values.join("\n");
  }

  function generateSubmission() {
    const submissionDate = todayString();
    const finalRate = form.requestedRate || estimatedRate || "TBD";
    const facilityName = form.siteName || settings.general.companyName || "Hiring Team";
    const greeting = (settings.templates.greetingLine || "Hello {facility},").replace(
      "{facility}",
      facilityName
    );

    const emailLines = [
      greeting,
      "",
      settings.templates.introLine || "Please see candidate details below:",
      "",
      "Candidate:",
      form.fullName || "N/A",
      `${form.phoneNumber || "N/A"} | ${form.emailAddress || "N/A"}`,
      form.location || "N/A",
    ];

    if (settings.templates.includeSubmissionDate) {
      emailLines.push(`Submitted: ${submissionDate}`);
    }

    emailLines.push(
      "",
      "Position Details:",
      `${form.position || "N/A"} | ${form.employmentType || "N/A"} | ${form.shiftPreference || "N/A"} | ${form.fte || "N/A"}`,
      "",
      "Experience:",
      form.yearsExperience || "N/A",
      form.experienceNotes || "N/A"
    );

    if (settings.templates.includeEducation) {
      emailLines.push("", "Education:", buildEducation(form));
    }

    emailLines.push("", "Compensation:", `Rate: ${finalRate}`);

    if (settings.templates.includeAvailability) {
      emailLines.push(
        "",
        "Availability:",
        `Start: ${form.startAvailability || "N/A"}`,
        form.startNotes ? `Start Notes: ${form.startNotes}` : "",
        `Interview: ${form.interviewAvailability || "N/A"}`
      );
    }

    if (settings.templates.includeCredentials && isHealthcare) {
      emailLines.push("", "Credentials:", buildCredentials() || "N/A");
    }

    emailLines.push(
      "",
      "Notes:",
      form.candidateNotes || "N/A",
      "",
      settings.templates.closingLine ||
        "The candidate is aware of the hiring process and is prepared to move forward.",
      "",
      settings.templates.followUpLine || "Please reach out within 24–48 hours.",
      "",
      settings.general.signOffName || settings.general.recruiterName || "",
      settings.general.signOffLine || ""
    );

    const detailedAts = [
      `Submitted ${form.fullName || "N/A"} for ${form.position || "N/A"} at ${facilityName}`,
      settings.templates.includeSubmissionDate ? `Date: ${submissionDate}` : "",
      `Exp: ${form.yearsExperience || "N/A"} | Rate: ${finalRate}`,
      settings.templates.includeAvailability
        ? `Avail: Start ${form.startAvailability || "N/A"} | Interview ${form.interviewAvailability || "N/A"}`
        : "",
      settings.templates.includeEducation ? `Edu: ${buildEducation(form)}` : "",
      settings.templates.includeCredentials && isHealthcare
        ? [
            form.licenseStatus ? `Lic: ${form.licenseStatus}` : "",
            form.cprStatus ? `CPR: ${form.cprStatus}` : "",
          ]
            .filter(Boolean)
            .join(" | ")
        : "",
      `Notes: ${form.candidateNotes || "N/A"}`,
    ]
      .filter(Boolean)
      .join("\n");

    const compactAts = [
      `${form.fullName || "N/A"} | ${form.position || "N/A"} | ${facilityName}`,
      `${form.yearsExperience || "N/A"} yrs exp | ${finalRate}`,
      settings.templates.includeAvailability
        ? `Start ${form.startAvailability || "N/A"} | Interview ${form.interviewAvailability || "N/A"}`
        : "",
      settings.templates.includeEducation ? buildEducation(form) : "",
      settings.templates.includeCredentials && isHealthcare
        ? [form.licenseStatus || "", form.cprStatus ? `CPR ${form.cprStatus}` : ""]
            .filter(Boolean)
            .join(" | ")
        : "",
      form.candidateNotes || "N/A",
    ]
      .filter(Boolean)
      .join("\n");

    setOutput({
      submissionDate,
      finalRate,
      emailBody: emailLines.filter((line) => line !== "").join("\n"),
      atsNote: settings.templates.atsStyle === "Compact" ? compactAts : detailedAts,
    });

    setRecentCandidates((prev) => [form, ...prev.filter((item) => item.fullName !== form.fullName)].slice(0, 8));
  }

  function useDemoWorkspace() {
    setSettings(DEFAULT_SETTINGS);
    setForm(DEMO_FORM);
    setRecentCandidates([DEMO_FORM]);
    setOutput(null);
    setActivePage("submission");
  }

  function exportSettings() {
    downloadFile("submission-assistant-settings.json", JSON.stringify(settings, null, 2));
  }

  function importSettings(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        setSettings(parsed);
        setOutput(null);
        alert("Settings imported");
      } catch (error) {
        console.error(error);
        alert("Import failed");
      }
    };
    reader.readAsText(file);
  }

  const mailtoHref = output
    ? `mailto:?subject=${encodeURIComponent(
        `Candidate Submission: ${form.fullName || "Candidate"} | ${form.position || "Role"} | ${form.siteName || settings.general.companyName || "Company"}`
      )}&body=${encodeURIComponent(output.emailBody)}`
    : "#";

  const pageStyle = {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)",
    color: "#0f172a",
    fontFamily: "Inter, Arial, sans-serif",
  };

  const shellStyle = {
    maxWidth: 1320,
    margin: "0 auto",
    padding: 28,
  };

  const gridTwo = {
    display: "grid",
    gap: 24,
    gridTemplateColumns: "1.08fr 0.92fr",
    alignItems: "start",
  };

  const settingsLayout = {
    display: "grid",
    gap: 24,
    gridTemplateColumns: "260px 1fr",
    alignItems: "start",
  };

  const fieldGrid = {
    display: "grid",
    gap: 18,
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  };

  return (
    <div style={pageStyle}>
      <div style={shellStyle}>
        <Card
          title="Recruiter Submission Assistant"
          subtitle="Use a clean submission page for recruiters and a separate settings area for workspace setup, sites, roles, rates, templates, and data."
          action={
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Button primary={activePage === "submission"} onClick={() => setActivePage("submission")}>
                Submission Assistant
              </Button>
              <Button primary={activePage === "settings"} onClick={() => setActivePage("settings")}>
                Settings
              </Button>
            </div>
          }
        >
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#64748b" }}>
            Configurable Recruiter Tool
          </div>
        </Card>

        {!settingsReady ? (
          <div style={{ marginTop: 24 }}>
            <Card
              title="Welcome"
              subtitle="No workspace setup found. Start with demo data or set up your workspace."
              action={
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <Button primary onClick={useDemoWorkspace}>Use Demo Workspace</Button>
                  <Button
                    onClick={() => {
                      setActivePage("settings");
                      setActiveSettingsTab("general");
                    }}
                  >
                    Set Up My Workspace
                  </Button>
                </div>
              }
            />
          </div>
        ) : null}

        <div style={{ marginTop: 24 }}>
          {activePage === "submission" ? (
            <div style={gridTwo}>
              <div style={{ display: "grid", gap: 24 }}>
                <Card
                  title="Enter Candidate"
                  subtitle="The recruiter-facing page stays clean. All buyer-specific setup lives in Settings."
                  action={<Button onClick={() => setForm(DEMO_FORM)}>Load Demo Candidate</Button>}
                >
                  <div style={fieldGrid}>
                    <Field label="Full Name">
                      <TextInput value={form.fullName} onChange={(e) => updateForm("fullName", e.target.value)} />
                    </Field>
                    <Field label="Phone Number">
                      <TextInput value={form.phoneNumber} onChange={(e) => updateForm("phoneNumber", e.target.value)} />
                    </Field>
                    <Field label="Email Address">
                      <TextInput value={form.emailAddress} onChange={(e) => updateForm("emailAddress", e.target.value)} />
                    </Field>
                    <Field label="Current Location">
                      <TextInput value={form.location} onChange={(e) => updateForm("location", e.target.value)} placeholder="Atlanta, GA" />
                    </Field>
                    <Field label="Position">
                      <SelectInput
                        value={form.position}
                        onChange={(e) => updateForm("position", e.target.value)}
                        options={activeRoles.map((role) => role.positionTitle)}
                        placeholder="Select position"
                      />
                    </Field>
                    <Field label="Site / Facility">
                      <SelectInput
                        value={form.siteName}
                        onChange={(e) => updateForm("siteName", e.target.value)}
                        options={activeSites.map((site) => site.siteName)}
                        placeholder="Select site"
                      />
                    </Field>
                    <Field label="Employment Type">
                      <SelectInput
                        value={form.employmentType}
                        onChange={(e) => updateForm("employmentType", e.target.value)}
                        options={settings.options.employmentTypes}
                        placeholder="Select employment type"
                      />
                    </Field>
                    <Field label="Shift Preference">
                      <SelectInput
                        value={form.shiftPreference}
                        onChange={(e) => updateForm("shiftPreference", e.target.value)}
                        options={settings.options.shiftOptions}
                        placeholder="Select shift"
                      />
                    </Field>
                    <Field label="FTE">
                      <SelectInput
                        value={form.fte}
                        onChange={(e) => updateForm("fte", e.target.value)}
                        options={settings.options.fteOptions}
                        placeholder="Select FTE"
                      />
                    </Field>
                    <Field label="Years of Experience">
                      <TextInput
                        value={form.yearsExperience}
                        onChange={(e) => updateForm("yearsExperience", e.target.value)}
                        type="number"
                      />
                    </Field>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <Field label="Experience Notes">
                        <TextArea value={form.experienceNotes} onChange={(e) => updateForm("experienceNotes", e.target.value)} />
                      </Field>
                    </div>
                    <Field label="Highest Education">
                      <SelectInput
                        value={form.educationLevel}
                        onChange={(e) => updateForm("educationLevel", e.target.value)}
                        options={settings.options.educationLevels}
                        placeholder="Select education"
                      />
                    </Field>
                    <Field label="Field of Study">
                      <TextInput value={form.fieldOfStudy} onChange={(e) => updateForm("fieldOfStudy", e.target.value)} />
                    </Field>
                    <Field label="School (Optional)">
                      <TextInput value={form.schoolName} onChange={(e) => updateForm("schoolName", e.target.value)} />
                    </Field>
                    <Field label="Estimated Rate">
                      <TextInput value={estimatedRate} readOnly onChange={() => undefined} />
                    </Field>
                    <Field label="Requested Rate Override">
                      <TextInput
                        value={form.requestedRate}
                        onChange={(e) => updateForm("requestedRate", e.target.value)}
                        placeholder="Optional override"
                      />
                    </Field>
                    <Field label="Start Availability">
                      <SelectInput
                        value={form.startAvailability}
                        onChange={(e) => updateForm("startAvailability", e.target.value)}
                        options={settings.options.startAvailabilityOptions}
                        placeholder="Select start availability"
                      />
                    </Field>
                    <Field label="Interview Availability">
                      <TextInput
                        value={form.interviewAvailability}
                        onChange={(e) => updateForm("interviewAvailability", e.target.value)}
                        placeholder="Mon–Fri after 4 PM"
                      />
                    </Field>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <Field label="Start Notes">
                        <TextInput value={form.startNotes} onChange={(e) => updateForm("startNotes", e.target.value)} />
                      </Field>
                    </div>

                    {isHealthcare && selectedRole?.requiresLicense ? (
                      <Field label="License Status">
                        <SelectInput
                          value={form.licenseStatus}
                          onChange={(e) => updateForm("licenseStatus", e.target.value)}
                          options={settings.options.licenseStatusOptions}
                          placeholder="Select license status"
                        />
                      </Field>
                    ) : null}

                    {isHealthcare && selectedRole?.requiresCpr ? (
                      <Field label="CPR Status">
                        <SelectInput
                          value={form.cprStatus}
                          onChange={(e) => updateForm("cprStatus", e.target.value)}
                          options={settings.options.cprStatusOptions}
                          placeholder="Select CPR status"
                        />
                      </Field>
                    ) : null}

                    {isHealthcare && selectedRole?.requiresLicense ? (
                      <Field label="Licensed Year">
                        <TextInput
                          value={form.licensedYear}
                          onChange={(e) => updateForm("licensedYear", e.target.value)}
                          placeholder="2019"
                        />
                      </Field>
                    ) : null}

                    <div style={{ gridColumn: "1 / -1" }}>
                      <Field label="Candidate Notes">
                        <TextArea value={form.candidateNotes} onChange={(e) => updateForm("candidateNotes", e.target.value)} />
                      </Field>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 20 }}>
                    <Button primary onClick={generateSubmission}>Generate Submission</Button>
                    <Button onClick={() => setForm({ ...DEMO_FORM, position: "", siteName: "" })}>Clear Form</Button>
                  </div>
                </Card>

                <Card title="Recent Candidates" subtitle="Light memory only, so recruiters can reload and regenerate.">
                  <div style={{ display: "grid", gap: 12 }}>
                    {recentCandidates.map((candidate, index) => (
                      <button
                        key={`${candidate.fullName}-${index}`}
                        type="button"
                        onClick={() => setForm(candidate)}
                        style={{
                          textAlign: "left",
                          border: "1px solid #e2e8f0",
                          borderRadius: 16,
                          padding: 16,
                          background: "#ffffff",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ fontWeight: 700 }}>{candidate.fullName || "Unnamed Candidate"}</div>
                        <div style={{ marginTop: 6, fontSize: 14, color: "#64748b" }}>
                          {candidate.position || "No position"} • {candidate.siteName || "No site"}
                        </div>
                      </button>
                    ))}
                  </div>
                </Card>
              </div>

              <div style={{ display: "grid", gap: 24 }}>
                <Card
                  title="Generated Output"
                  subtitle="Copy and send without rewriting."
                  action={output ? <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>{output.submissionDate}</div> : null}
                >
                  {!output ? (
                    <div
                      style={{
                        border: "1px dashed #cbd5e1",
                        borderRadius: 16,
                        padding: 32,
                        textAlign: "center",
                        color: "#64748b",
                      }}
                    >
                      Fill the form, then click <strong>Generate Submission</strong>.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 20 }}>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 10, alignItems: "center" }}>
                          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#64748b" }}>
                            Submission Email
                          </div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <a
                              href={mailtoHref}
                              style={{
                                padding: "12px 16px",
                                borderRadius: 12,
                                background: "#0f172a",
                                color: "#ffffff",
                                textDecoration: "none",
                                fontWeight: 700,
                              }}
                            >
                              Open in Outlook
                            </a>
                            <Button onClick={() => safeClipboardWrite(output.emailBody).catch(() => alert("Copy failed"))}>
                              Copy Email
                            </Button>
                          </div>
                        </div>
                        <pre
                          style={{
                            margin: 0,
                            whiteSpace: "pre-wrap",
                            background: "#f8fafc",
                            border: "1px solid #e2e8f0",
                            borderRadius: 16,
                            padding: 16,
                            lineHeight: 1.6,
                            overflowX: "auto",
                          }}
                        >
                          {output.emailBody}
                        </pre>
                      </div>

                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 10, alignItems: "center" }}>
                          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#64748b" }}>
                            ATS Note
                          </div>
                          <Button onClick={() => safeClipboardWrite(output.atsNote).catch(() => alert("Copy failed"))}>
                            Copy ATS Note
                          </Button>
                        </div>
                        <pre
                          style={{
                            margin: 0,
                            whiteSpace: "pre-wrap",
                            background: "#f8fafc",
                            border: "1px solid #e2e8f0",
                            borderRadius: 16,
                            padding: 16,
                            lineHeight: 1.6,
                            overflowX: "auto",
                          }}
                        >
                          {output.atsNote}
                        </pre>
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          ) : (
            <div style={settingsLayout}>
              <aside
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 20,
                  padding: 16,
                  height: "fit-content",
                }}
              >
                <div style={{ display: "grid", gap: 8 }}>
                  {[
                    ["general", "General"],
                    ["sites", "Sites"],
                    ["roles", "Roles"],
                    ["rates", "Rates"],
                    ["templates", "Templates"],
                    ["data", "Data"],
                  ].map(([key, label]) => (
                    <NavButton key={key} active={activeSettingsTab === key} onClick={() => setActiveSettingsTab(key)}>
                      {label}
                    </NavButton>
                  ))}
                </div>
              </aside>

              <div style={{ display: "grid", gap: 24 }}>
                {activeSettingsTab === "general" ? (
                  <>
                    <Card title="Workspace Setup" subtitle="This personalizes the product immediately without touching code.">
                      <div style={fieldGrid}>
                        <Field label="Workspace Name">
                          <TextInput value={settings.general.workspaceName} onChange={(e) => updateGeneral("workspaceName", e.target.value)} />
                        </Field>
                        <Field label="Company Name">
                          <TextInput value={settings.general.companyName} onChange={(e) => updateGeneral("companyName", e.target.value)} />
                        </Field>
                        <Field label="Recruiter Name">
                          <TextInput value={settings.general.recruiterName} onChange={(e) => updateGeneral("recruiterName", e.target.value)} />
                        </Field>
                        <Field label="Recruiter Email">
                          <TextInput value={settings.general.recruiterEmail} onChange={(e) => updateGeneral("recruiterEmail", e.target.value)} />
                        </Field>
                        <Field label="Recruiter Phone">
                          <TextInput value={settings.general.recruiterPhone} onChange={(e) => updateGeneral("recruiterPhone", e.target.value)} />
                        </Field>
                        <Field label="Sign-Off Name">
                          <TextInput value={settings.general.signOffName} onChange={(e) => updateGeneral("signOffName", e.target.value)} />
                        </Field>
                        <div style={{ gridColumn: "1 / -1" }}>
                          <Field label="Sign-Off Line">
                            <TextArea value={settings.general.signOffLine} onChange={(e) => updateGeneral("signOffLine", e.target.value)} />
                          </Field>
                        </div>
                      </div>
                    </Card>

                    <Card title="Dropdown Options" subtitle="Editable lists so buyers never need to change code.">
                      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                        <TagListEditor label="Employment Types" values={settings.options.employmentTypes} onChange={(value) => updateOptions("employmentTypes", value)} />
                        <TagListEditor label="Shift Options" values={settings.options.shiftOptions} onChange={(value) => updateOptions("shiftOptions", value)} />
                        <TagListEditor label="FTE Options" values={settings.options.fteOptions} onChange={(value) => updateOptions("fteOptions", value)} />
                        <TagListEditor label="Start Availability" values={settings.options.startAvailabilityOptions} onChange={(value) => updateOptions("startAvailabilityOptions", value)} />
                        <TagListEditor label="Education Levels" values={settings.options.educationLevels} onChange={(value) => updateOptions("educationLevels", value)} />
                        <TagListEditor label="License Status" values={settings.options.licenseStatusOptions} onChange={(value) => updateOptions("licenseStatusOptions", value)} />
                        <TagListEditor label="CPR Status" values={settings.options.cprStatusOptions} onChange={(value) => updateOptions("cprStatusOptions", value)} />
                      </div>
                    </Card>
                  </>
                ) : null}

                {activeSettingsTab === "sites" ? (
                  <Card title="Sites / Facilities" subtitle="Buyers add their own sites here. Nothing is hardcoded in the submission form." action={<Button onClick={addSite}>Add Site</Button>}>
                    <div style={{ display: "grid", gap: 16 }}>
                      {settings.sites.map((site) => (
                        <div key={site.id} style={{ border: "1px solid #e2e8f0", borderRadius: 16, padding: 16 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>Site Record</div>
                            <button type="button" onClick={() => removeSite(site.id)} style={{ border: "none", background: "transparent", color: "#dc2626", fontWeight: 700, cursor: "pointer" }}>
                              Delete
                            </button>
                          </div>
                          <div style={fieldGrid}>
                            <Field label="Site Name">
                              <TextInput value={site.siteName} onChange={(e) => updateSite(site.id, "siteName", e.target.value)} />
                            </Field>
                            <Field label="Site Type">
                              <TextInput value={site.siteType} onChange={(e) => updateSite(site.id, "siteType", e.target.value)} placeholder="24-hour, Hospital, Corporate" />
                            </Field>
                            <Field label="Location">
                              <TextInput value={site.location} onChange={(e) => updateSite(site.id, "location", e.target.value)} />
                            </Field>
                            <Field label="Status">
                              <SelectInput value={site.status} onChange={(e) => updateSite(site.id, "status", e.target.value)} options={["Active", "Inactive"]} placeholder="Select status" />
                            </Field>
                            <div style={{ gridColumn: "1 / -1" }}>
                              <Field label="Notes">
                                <TextArea value={site.notes} onChange={(e) => updateSite(site.id, "notes", e.target.value)} />
                              </Field>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                ) : null}

                {activeSettingsTab === "roles" ? (
                  <Card title="Roles / Positions" subtitle="These records control which fields appear in the submission form." action={<Button onClick={addRole}>Add Role</Button>}>
                    <div style={{ display: "grid", gap: 16 }}>
                      {settings.roles.map((role) => (
                        <div key={role.id} style={{ border: "1px solid #e2e8f0", borderRadius: 16, padding: 16 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>Role Record</div>
                            <button type="button" onClick={() => removeRole(role.id)} style={{ border: "none", background: "transparent", color: "#dc2626", fontWeight: 700, cursor: "pointer" }}>
                              Delete
                            </button>
                          </div>
                          <div style={fieldGrid}>
                            <Field label="Position Title">
                              <TextInput value={role.positionTitle} onChange={(e) => updateRole(role.id, "positionTitle", e.target.value)} />
                            </Field>
                            <Field label="Role Category">
                              <SelectInput value={role.roleCategory} onChange={(e) => updateRole(role.id, "roleCategory", e.target.value)} options={["Healthcare", "General"]} placeholder="Select role category" />
                            </Field>
                            <ToggleField label="Requires License" checked={role.requiresLicense} onChange={(value) => updateRole(role.id, "requiresLicense", value)} />
                            <ToggleField label="Requires CPR" checked={role.requiresCpr} onChange={(value) => updateRole(role.id, "requiresCpr", value)} />
                            <ToggleField label="Requires FTE" checked={role.requiresFte} onChange={(value) => updateRole(role.id, "requiresFte", value)} />
                            <ToggleField label="Requires Shift" checked={role.requiresShift} onChange={(value) => updateRole(role.id, "requiresShift", value)} />
                            <Field label="Status">
                              <SelectInput value={role.status} onChange={(e) => updateRole(role.id, "status", e.target.value)} options={["Active", "Inactive"]} placeholder="Select status" />
                            </Field>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                ) : null}

                {activeSettingsTab === "rates" ? (
                  <>
                    <Card title="Rate Setup" subtitle="Turn automatic rate logic on or off. If off, recruiters use manual rate only.">
                      <ToggleField label="Enable Automatic Rate Calculation" checked={settings.rates.enabled} onChange={(value) => setSettings((prev) => ({ ...prev, rates: { ...prev.rates, enabled: value } }))} />
                    </Card>

                    {settings.rates.enabled ? (
                      <Card title="Rate Rules" subtitle="Simple grid logic, not an Excel-looking mess." action={<Button onClick={addRateRule}>Add Rate Rule</Button>}>
                        <div style={{ display: "grid", gap: 16 }}>
                          {settings.rates.rules.map((rule) => (
                            <div key={rule.id} style={{ border: "1px solid #e2e8f0", borderRadius: 16, padding: 16 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                                <div style={{ fontWeight: 700, fontSize: 14 }}>Rate Rule</div>
                                <button type="button" onClick={() => removeRateRule(rule.id)} style={{ border: "none", background: "transparent", color: "#dc2626", fontWeight: 700, cursor: "pointer" }}>
                                  Delete
                                </button>
                              </div>
                              <div style={fieldGrid}>
                                <Field label="Position">
                                  <SelectInput value={rule.positionTitle} onChange={(e) => updateRateRule(rule.id, "positionTitle", e.target.value)} options={settings.roles.map((role) => role.positionTitle).filter(Boolean)} placeholder="Select role" />
                                </Field>
                                <Field label="Scope Type">
                                  <SelectInput value={rule.scopeType} onChange={(e) => updateRateRule(rule.id, "scopeType", e.target.value)} options={["Site Type", "Site"]} placeholder="Select scope type" />
                                </Field>
                                <Field label={rule.scopeType === "Site Type" ? "Site Type" : "Site Name"}>
                                  <SelectInput
                                    value={rule.scopeValue}
                                    onChange={(e) => updateRateRule(rule.id, "scopeValue", e.target.value)}
                                    options={
                                      rule.scopeType === "Site Type"
                                        ? [...new Set(settings.sites.map((site) => site.siteType).filter(Boolean))]
                                        : settings.sites.map((site) => site.siteName).filter(Boolean)
                                    }
                                    placeholder="Select value"
                                  />
                                </Field>
                                <Field label="Experience Tier">
                                  <SelectInput value={rule.experienceTier} onChange={(e) => updateRateRule(rule.id, "experienceTier", e.target.value)} options={["0–2", "3–5", "6–10", "11–15", "16+"]} placeholder="Select tier" />
                                </Field>
                                <Field label="Rate">
                                  <TextInput value={rule.rate} onChange={(e) => updateRateRule(rule.id, "rate", e.target.value)} placeholder="$42.25/hr" />
                                </Field>
                                <Field label="Employment Type (Optional)">
                                  <SelectInput value={rule.employmentType} onChange={(e) => updateRateRule(rule.id, "employmentType", e.target.value)} options={settings.options.employmentTypes} placeholder="Any" />
                                </Field>
                                <Field label="Shift (Optional)">
                                  <SelectInput value={rule.shift} onChange={(e) => updateRateRule(rule.id, "shift", e.target.value)} options={settings.options.shiftOptions} placeholder="Any" />
                                </Field>
                              </div>
                            </div>
                          ))}
                        </div>
                      </Card>
                    ) : (
                      <Card title="Manual Rate Only" subtitle="Automatic rate calculation is off. Recruiters can still enter a requested rate manually on the submission page." />
                    )}
                  </>
                ) : null}

                {activeSettingsTab === "templates" ? (
                  <>
                    <Card title="Email Template Settings" subtitle="Controlled text blocks so buyers can personalize wording without breaking structure.">
                      <div style={fieldGrid}>
                        <Field label="Greeting Line">
                          <TextInput value={settings.templates.greetingLine} onChange={(e) => updateTemplates("greetingLine", e.target.value)} />
                        </Field>
                        <Field label="Intro Line">
                          <TextInput value={settings.templates.introLine} onChange={(e) => updateTemplates("introLine", e.target.value)} />
                        </Field>
                        <Field label="Follow-Up Line">
                          <TextInput value={settings.templates.followUpLine} onChange={(e) => updateTemplates("followUpLine", e.target.value)} />
                        </Field>
                        <Field label="Closing Line">
                          <TextInput value={settings.templates.closingLine} onChange={(e) => updateTemplates("closingLine", e.target.value)} />
                        </Field>
                      </div>
                    </Card>

                    <Card title="ATS Template Settings" subtitle="Adjust output without breaking the underlying structure.">
                      <div style={fieldGrid}>
                        <Field label="ATS Style">
                          <SelectInput value={settings.templates.atsStyle} onChange={(e) => updateTemplates("atsStyle", e.target.value)} options={["Detailed", "Compact"]} placeholder="Select ATS style" />
                        </Field>
                        <div />
                        <ToggleField label="Include Submission Date" checked={settings.templates.includeSubmissionDate} onChange={(value) => updateTemplates("includeSubmissionDate", value)} />
                        <ToggleField label="Include Education" checked={settings.templates.includeEducation} onChange={(value) => updateTemplates("includeEducation", value)} />
                        <ToggleField label="Include Availability" checked={settings.templates.includeAvailability} onChange={(value) => updateTemplates("includeAvailability", value)} />
                        <ToggleField label="Include Credentials" checked={settings.templates.includeCredentials} onChange={(value) => updateTemplates("includeCredentials", value)} />
                      </div>
                    </Card>
                  </>
                ) : null}

                {activeSettingsTab === "data" ? (
                  <Card title="Data Tools" subtitle="Demo, reset, export, and import so buyers can manage their workspace cleanly.">
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <Button onClick={useDemoWorkspace}>Load Demo Workspace</Button>
                      <Button
                        onClick={() => {
                          setSettings({
                            ...DEFAULT_SETTINGS,
                            sites: [],
                            roles: [],
                            rates: { ...DEFAULT_SETTINGS.rates, rules: [] },
                          });
                          setOutput(null);
                          alert("Workspace reset");
                        }}
                        style={{ borderColor: "#fecaca", color: "#b91c1c" }}
                      >
                        Reset Workspace
                      </Button>
                      <Button onClick={exportSettings}>Export Settings</Button>
                      <label
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "12px 16px",
                          borderRadius: 12,
                          border: "1px solid #cbd5e1",
                          fontWeight: 700,
                          cursor: "pointer",
                          background: "#ffffff",
                        }}
                      >
                        Import Settings
                        <input type="file" accept="application/json" onChange={importSettings} style={{ display: "none" }} />
                      </label>
                    </div>
                  </Card>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

