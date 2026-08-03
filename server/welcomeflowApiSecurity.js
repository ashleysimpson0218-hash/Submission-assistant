const crypto = require("crypto");

function configuredValue(...names) {
  return names.map((name) => String(process.env[name] || "").trim()).find(Boolean) || "";
}

function bearerToken(req = {}) {
  const value = String(req.headers?.authorization || req.headers?.Authorization || "").trim();
  const match = value.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] || "";
}

function publicSupabaseConfig() {
  return {
    url: configuredValue("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "REACT_APP_SUPABASE_URL"),
    key: configuredValue("SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "REACT_APP_SUPABASE_ANON_KEY"),
  };
}

function serviceSupabaseConfig() {
  return {
    url: configuredValue("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "REACT_APP_SUPABASE_URL"),
    key: configuredValue("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"),
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
  const { url, key } = publicSupabaseConfig();
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

function serviceSupabaseClient() {
  const { url, key } = serviceSupabaseConfig();
  return createSupabaseClient(url, key);
}

function positiveInteger(value, fallback, maximum = 10000) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(maximum, Math.floor(parsed));
}

function requestIp(req = {}) {
  const forwarded = String(req.headers?.["x-forwarded-for"] || req.headers?.["X-Forwarded-For"] || "").split(",")[0].trim();
  return forwarded || String(req.headers?.["x-real-ip"] || req.socket?.remoteAddress || "unknown").trim() || "unknown";
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
  consumeSharedRateLimits,
  opaqueSubject,
  positiveInteger,
  requestIp,
  requestPayloadBytes,
  serviceSupabaseClient,
};
