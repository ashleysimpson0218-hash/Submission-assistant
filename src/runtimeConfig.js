export const PRODUCTION_SUPABASE_PROJECT_REF = "qfpgednixvveelgwfylv";
export const SYNTHETIC_TEST_SUPABASE_PROJECT_REF = "bjverobaoujhfaylyrzi";
export const OWNER_UAT_SUPABASE_PROJECT_REF = "zleslkwnbjxknmkqywyv";
export const DEFAULT_WORKSPACE_ID = "default";

function firstConfigured(env, reactName, serverName) {
  return String(env[reactName] ?? env[serverName] ?? "").trim();
}

function enabledFlag(value, fallback = false) {
  if (value === "") return fallback;
  return String(value).trim().toLowerCase() === "true";
}

function expectedCount(env, name) {
  const raw = firstConfigured(env, `REACT_APP_WELCOMEFLOW_EXPECTED_${name}`, `WELCOMEFLOW_EXPECTED_${name}`);
  return /^\d+$/.test(raw) ? Number(raw) : null;
}

export function readWorkspaceRuntimeConfig(env = process.env) {
  const requestedWorkspaceId = firstConfigured(env, "REACT_APP_WELCOMEFLOW_WORKSPACE_ID", "WELCOMEFLOW_WORKSPACE_ID");
  const acceptanceMode = enabledFlag(firstConfigured(env, "REACT_APP_WELCOMEFLOW_ACCEPTANCE_MODE", "WELCOMEFLOW_ACCEPTANCE_MODE"));
  const autosaveValue = firstConfigured(env, "REACT_APP_WELCOMEFLOW_AUTOSAVE", "WELCOMEFLOW_AUTOSAVE");
  const autosaveEnabled = enabledFlag(autosaveValue, true);
  const expectedCounts = {
    candidates: expectedCount(env, "CANDIDATES"),
    facilities: expectedCount(env, "FACILITIES"),
    requisitions: expectedCount(env, "REQUISITIONS"),
    history: expectedCount(env, "HISTORY"),
    reportHistory: expectedCount(env, "REPORT_HISTORY"),
  };
  const expectedFingerprint = firstConfigured(env, "REACT_APP_WELCOMEFLOW_EXPECTED_WORKSPACE_FINGERPRINT", "WELCOMEFLOW_EXPECTED_WORKSPACE_FINGERPRINT").toLowerCase();
  const workspaceId = requestedWorkspaceId || DEFAULT_WORKSPACE_ID;

  if (acceptanceMode && !requestedWorkspaceId) {
    return { ok: false, error: "Acceptance mode requires an explicit WelcomeFlow workspace ID.", workspaceId, acceptanceMode, autosaveEnabled, expectedCounts, expectedFingerprint };
  }
  if (acceptanceMode && workspaceId === DEFAULT_WORKSPACE_ID) {
    return { ok: false, error: "Acceptance mode refuses the default workspace.", workspaceId, acceptanceMode, autosaveEnabled, expectedCounts, expectedFingerprint };
  }
  const missingExpectedCounts = Object.entries(expectedCounts).filter(([, value]) => value === null).map(([name]) => name);
  if (acceptanceMode && (missingExpectedCounts.length || !expectedFingerprint)) {
    return {
      ok: false,
      error: `Acceptance mode requires expected workspace counts and fingerprint${missingExpectedCounts.length ? ` (missing: ${missingExpectedCounts.join(", ")})` : ""}.`,
      workspaceId,
      acceptanceMode,
      autosaveEnabled,
      expectedCounts,
      expectedFingerprint,
    };
  }
  return { ok: true, workspaceId, acceptanceMode, autosaveEnabled, expectedCounts, expectedFingerprint };
}

export function projectRefFromSupabaseUrl(value = "") {
  try {
    const hostname = new URL(String(value)).hostname.toLowerCase();
    const match = hostname.match(/^([a-z0-9]+)\.supabase\.co$/);
    return match?.[1] || "";
  } catch {
    return "";
  }
}

export function readRuntimeConfig(env = process.env) {
  const environment = String(env.REACT_APP_ENVIRONMENT || "").trim().toLowerCase();
  const workspace = readWorkspaceRuntimeConfig(env);
  const isUat = environment === "uat";
  const supabaseUrl = String(env.REACT_APP_SUPABASE_URL || "").trim();
  const supabaseAnonKey = String(env.REACT_APP_SUPABASE_ANON_KEY || "").trim();
  const allowedProjectRef = String(env.REACT_APP_ALLOWED_SUPABASE_PROJECT_REF || "").trim().toLowerCase();
  const projectRef = projectRefFromSupabaseUrl(supabaseUrl);
  const missing = [
    ["REACT_APP_ENVIRONMENT", environment],
    ["REACT_APP_SUPABASE_URL", supabaseUrl],
    ["REACT_APP_SUPABASE_ANON_KEY", supabaseAnonKey],
    ["REACT_APP_ALLOWED_SUPABASE_PROJECT_REF", allowedProjectRef],
  ].filter(([, value]) => !value).map(([name]) => name);

  if (missing.length) {
    return { ok: false, error: `Missing required configuration: ${missing.join(", ")}.`, environment, projectRef, allowedProjectRef };
  }
  if (!workspace.ok) {
    return { ...workspace, ok: false, error: workspace.error, environment, projectRef, allowedProjectRef };
  }
  if (workspace.acceptanceMode && environment !== "test") {
    return { ...workspace, ok: false, error: "Acceptance mode is available only in the synthetic test environment.", environment, projectRef, allowedProjectRef };
  }
  if (isUat) {
    if ([PRODUCTION_SUPABASE_PROJECT_REF, SYNTHETIC_TEST_SUPABASE_PROJECT_REF].includes(allowedProjectRef)) {
      return { ok: false, error: "Owner UAT refuses the production and synthetic-test Supabase projects.", environment, projectRef: allowedProjectRef, allowedProjectRef };
    }
    if (!projectRef || projectRef !== allowedProjectRef || projectRef !== OWNER_UAT_SUPABASE_PROJECT_REF) {
      return { ok: false, error: "Owner UAT requires the explicitly approved Owner UAT Supabase project.", environment, projectRef, allowedProjectRef };
    }
    return {
      ok: true,
      environment,
      isTest: false,
      isUat: true,
      isReadOnly: false,
      controlledWrites: true,
      supabaseUrl,
      supabaseAnonKey,
      supabasePublishableKey: supabaseAnonKey,
      projectRef,
      allowedProjectRef,
      ...workspace,
    };
  }
  if (!projectRef) {
    return { ok: false, error: "REACT_APP_SUPABASE_URL is not a valid Supabase project URL.", environment, projectRef, allowedProjectRef };
  }
  if (projectRef !== allowedProjectRef) {
    return { ok: false, error: "The configured Supabase URL does not match the explicitly allowed project ref.", environment, projectRef, allowedProjectRef };
  }
  if (environment === "test" && projectRef === PRODUCTION_SUPABASE_PROJECT_REF) {
    return { ok: false, error: "Test mode refuses to connect to the production Supabase project.", environment, projectRef, allowedProjectRef };
  }

  return { ok: true, environment, isTest: environment === "test", isUat: false, isReadOnly: false, supabaseUrl, supabaseAnonKey, supabasePublishableKey: supabaseAnonKey, projectRef, allowedProjectRef, ...workspace };
}
