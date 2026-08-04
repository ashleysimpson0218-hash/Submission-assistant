const crypto = require("crypto");

const PRODUCTION_SUPABASE_PROJECT_REF = "qfpgednixvveelgwfylv";
const SYNTHETIC_TEST_SUPABASE_PROJECT_REF = "bjverobaoujhfaylyrzi";
const OWNER_UAT_SUPABASE_PROJECT_REF = "zleslkwnbjxknmkqywyv";
const SUPPORTED_SERVER_ENVIRONMENTS = new Set(["development", "test", "acceptance", "preview", "owner-uat", "production"]);
const ACTION_ENABLE_FLAGS = Object.freeze({
  email: "WELCOMEFLOW_ENABLE_EMAIL_ACTIONS",
  resume: "WELCOMEFLOW_ENABLE_RESUME_ACTIONS",
  booking: "WELCOMEFLOW_ENABLE_BOOKING_ACTIONS",
});

function configuredValue(...names) {
  return names.map((name) => String(process.env[name] || "").trim()).find(Boolean) || "";
}

function projectRefFromSupabaseUrl(value = "") {
  try {
    const parsed = new URL(String(value));
    const match = parsed.protocol === "https:" && !parsed.username && !parsed.password
      ? parsed.hostname.toLowerCase().match(/^([a-z0-9]+)\.supabase\.co$/)
      : null;
    return match?.[1] || "";
  } catch {
    return "";
  }
}

function enabledServerFlag(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

function readServerRuntimeConfig(action = "", env = process.env) {
  const environment = String(env.WELCOMEFLOW_SERVER_ENV || "").trim().toLowerCase();
  const allowedProjectRef = String(env.WELCOMEFLOW_ALLOWED_SUPABASE_PROJECT_REF || "").trim().toLowerCase();
  const supabaseUrl = String(env.SUPABASE_URL || "").trim();
  const projectRef = projectRefFromSupabaseUrl(supabaseUrl);
  const serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || "").trim();
  const publicKey = String(env.SUPABASE_ANON_KEY || "").trim();
  const actionFlag = ACTION_ENABLE_FLAGS[action] || "";

  if (!SUPPORTED_SERVER_ENVIRONMENTS.has(environment)) return { ok: false, error: "Server runtime is not configured safely." };
  if (!allowedProjectRef || !projectRef || projectRef !== allowedProjectRef) return { ok: false, error: "Server runtime is not configured safely." };
  if (!serviceKey) return { ok: false, error: "Server runtime is not configured safely." };
  if (["development", "test", "acceptance", "preview"].includes(environment) && [PRODUCTION_SUPABASE_PROJECT_REF, OWNER_UAT_SUPABASE_PROJECT_REF].includes(projectRef)) {
    return { ok: false, error: "Server runtime is not configured safely." };
  }
  if (environment === "owner-uat" && projectRef !== OWNER_UAT_SUPABASE_PROJECT_REF) return { ok: false, error: "Server runtime is not configured safely." };
  if (environment === "production" && projectRef !== PRODUCTION_SUPABASE_PROJECT_REF) return { ok: false, error: "Server runtime is not configured safely." };
  if (environment === "acceptance" && projectRef !== SYNTHETIC_TEST_SUPABASE_PROJECT_REF) return { ok: false, error: "Server runtime is not configured safely." };
  if (actionFlag && !enabledServerFlag(env[actionFlag])) return { ok: false, error: "This server action is disabled." };

  return { ok: true, environment, allowedProjectRef, projectRef, supabaseUrl, serviceKey, publicKey, action };
}

function bearerToken(req = {}) {
  const value = String(req.headers?.authorization || req.headers?.Authorization || "").trim();
  const match = value.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] || "";
}

function publicSupabaseConfig(runtime = readServerRuntimeConfig()) {
  return {
    url: runtime.ok ? runtime.supabaseUrl : "",
    key: runtime.ok ? runtime.publicKey : "",
  };
}

function serviceSupabaseConfig(runtime = readServerRuntimeConfig()) {
  return {
    url: runtime.ok ? runtime.supabaseUrl : "",
    key: runtime.ok ? runtime.serviceKey : "",
  };
}

function createSupabaseClient(url, key, authorization = "") {
  if (!url || !key) return null;
  const { createClient } = require("@supabase/supabase-js");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(authorization ? { global: { headers: { Authorization: authorization } } } : {}),
  });
}

async function authenticatedUser(req = {}) {
  const token = bearerToken(req);
  if (!token) return { error: "Authorization is required." };
  const runtime = readServerRuntimeConfig();
  const { url, key } = publicSupabaseConfig(runtime);
  if (!url || !key) return { error: "Authorization is not configured.", unavailable: true };

  try {
    const client = createSupabaseClient(url, key, `Bearer ${token}`);
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user?.id) return { error: "Authorization is invalid or expired." };
    return { user: data.user };
  } catch {
    return { error: "Authorization could not be verified.", unavailable: true };
  }
}

function configuredList(...names) {
  return configuredValue(...names)
    .split(/[;,\s]+/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function requestWorkspaceId(req = {}) {
  const value = String(
    req.headers?.["x-welcomeflow-workspace-id"]
      || req.headers?.["X-WelcomeFlow-Workspace-Id"]
      || "",
  ).trim();
  return /^[a-z0-9][a-z0-9_-]{0,79}$/i.test(value) ? value : "";
}

async function authorizedRecruiter(req = {}) {
  const authentication = await authenticatedUser(req);
  if (!authentication.user) return authentication;

  const workspaceId = requestWorkspaceId(req);
  const allowedRoles = new Set(configuredList("WELCOMEFLOW_AUTHORIZED_RECRUITER_ROLES"));
  const allowedWorkspaces = new Set(configuredList("WELCOMEFLOW_API_WORKSPACE_IDS"));
  if (!workspaceId || !allowedRoles.size || !allowedWorkspaces.size) {
    return { error: "Recruiter authorization is not configured.", unavailable: true };
  }

  const appMetadata = authentication.user.app_metadata || {};
  const role = String(appMetadata.welcomeflow_role || "").trim().toLowerCase();
  const memberships = new Set(
    (Array.isArray(appMetadata.welcomeflow_workspace_ids) ? appMetadata.welcomeflow_workspace_ids : [])
      .map((value) => String(value || "").trim().toLowerCase())
      .filter(Boolean),
  );
  const normalizedWorkspaceId = workspaceId.toLowerCase();
  if (!allowedRoles.has(role) || !allowedWorkspaces.has(normalizedWorkspaceId) || !memberships.has(normalizedWorkspaceId)) {
    return { error: "This account is not authorized for the requested WelcomeFlow workspace.", forbidden: true };
  }
  return { user: authentication.user, role, workspaceId };
}

function serviceSupabaseClient(runtime = readServerRuntimeConfig()) {
  const { url, key } = serviceSupabaseConfig(runtime);
  return createSupabaseClient(url, key);
}

function positiveInteger(value, fallback, maximum = 10000) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(maximum, Math.floor(parsed));
}

function requestIp(req = {}) {
  const headers = req.headers || {};
  const isTrustedVercelRequest = process.env.VERCEL === "1";
  if (isTrustedVercelRequest) {
    const forwarded = String(headers["x-forwarded-for"] || headers["X-Forwarded-For"] || "").split(",")[0].trim();
    const realIp = String(headers["x-real-ip"] || headers["X-Real-Ip"] || "").trim();
    if (forwarded || realIp) return forwarded || realIp;
  }
  return String(req.socket?.remoteAddress || "unknown").trim() || "unknown";
}

function opaqueSubject(value = "") {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex");
}

async function consumeSharedRateLimits({ action, subjects, limit, windowSeconds = 60 } = {}) {
  const client = serviceSupabaseClient();
  if (!client) return { ok: false, unavailable: true, error: "Shared abuse protection is not configured." };
  const normalizedAction = String(action || "").trim().slice(0, 80);
  const subjectHashes = Array.from(new Set(
    (Array.isArray(subjects) ? subjects : [])
      .map((subject) => String(subject || "").trim().slice(0, 256))
      .filter(Boolean)
      .map(opaqueSubject),
  )).sort();
  if (!normalizedAction || subjectHashes.length < 2 || subjectHashes.length > 8) {
    return { ok: false, unavailable: true, error: "Shared abuse protection could not identify this request." };
  }

  try {
    const { data, error } = await client.rpc("welcomeflow_consume_api_rate_limits", {
      p_action: normalizedAction,
      p_subject_hashes: subjectHashes,
      p_limit: positiveInteger(limit, 10, 1000),
      p_window_seconds: positiveInteger(windowSeconds, 60, 86400),
    });
    if (error || typeof data !== "boolean") {
      return { ok: false, unavailable: true, error: "Shared abuse protection is unavailable." };
    }
    return { ok: data, limited: !data };
  } catch {
    return { ok: false, unavailable: true, error: "Shared abuse protection is unavailable." };
  }
}

async function consumePreAuthenticationRateLimit(req = {}, { action, limit, windowSeconds = 60 } = {}) {
  const normalizedAction = String(action || "").trim().slice(0, 64);
  const ip = requestIp(req);
  if (!normalizedAction || !ip || ip === "unknown") {
    return { ok: false, unavailable: true, error: "Shared abuse protection could not identify this request." };
  }
  return consumeSharedRateLimits({
    action: `${normalizedAction}-preauth`,
    subjects: [`preauth-ip:${ip}`, `preauth-route:${normalizedAction}:${ip}`],
    limit: positiveInteger(limit, 30, 1000),
    windowSeconds,
  });
}

function requestPayloadBytes(req = {}) {
  const headerBytes = Number(req.headers?.["content-length"] || req.headers?.["Content-Length"] || 0);
  let serialized = "";
  try {
    serialized = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
  const actualBytes = Buffer.byteLength(serialized, "utf8");
  return Math.max(Number.isFinite(headerBytes) && headerBytes > 0 ? headerBytes : 0, actualBytes);
}

module.exports = {
  authenticatedUser,
  authorizedRecruiter,
  consumePreAuthenticationRateLimit,
  consumeSharedRateLimits,
  opaqueSubject,
  positiveInteger,
  requestIp,
  requestPayloadBytes,
  readServerRuntimeConfig,
  serviceSupabaseClient,
  projectRefFromSupabaseUrl,
};
