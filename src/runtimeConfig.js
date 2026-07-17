export const PRODUCTION_SUPABASE_PROJECT_REF = "qfpgednixvveelgwfylv";

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
  if (!projectRef) {
    return { ok: false, error: "REACT_APP_SUPABASE_URL is not a valid Supabase project URL.", environment, projectRef, allowedProjectRef };
  }
  if (projectRef !== allowedProjectRef) {
    return { ok: false, error: "The configured Supabase URL does not match the explicitly allowed project ref.", environment, projectRef, allowedProjectRef };
  }
  if (environment === "test" && projectRef === PRODUCTION_SUPABASE_PROJECT_REF) {
    return { ok: false, error: "Test mode refuses to connect to the production Supabase project.", environment, projectRef, allowedProjectRef };
  }

  return { ok: true, environment, isTest: environment === "test", supabaseUrl, supabaseAnonKey, projectRef, allowedProjectRef };
}
