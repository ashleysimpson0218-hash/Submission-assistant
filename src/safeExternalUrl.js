function configuredHosts(value = process.env.REACT_APP_WELCOMEFLOW_EXTERNAL_LINK_HOSTS || "") {
  return String(value || "")
    .split(/[;,\s]+/)
    .map((host) => host.trim().toLowerCase().replace(/\.$/, ""))
    .filter((host) => /^(?:\*\.)?[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(host));
}

function hostIsAllowed(hostname, rules) {
  const host = String(hostname || "").toLowerCase().replace(/\.$/, "");
  return rules.some((rule) => rule.startsWith("*.")
    ? host.endsWith(rule.slice(1)) && host !== rule.slice(2)
    : host === rule);
}

export function validateExternalUrl(value, hostConfiguration) {
  let parsed;
  try {
    parsed = new URL(String(value || ""));
  } catch {
    return { ok: false, reason: "invalid" };
  }
  const rules = configuredHosts(hostConfiguration);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || !rules.length || !hostIsAllowed(parsed.hostname, rules)) {
    return { ok: false, reason: "not-allowed" };
  }
  return { ok: true, url: parsed.href, hostname: parsed.hostname };
}

export function openApprovedExternalUrl(value, { target = "_blank", hostConfiguration, windowObject = typeof window === "undefined" ? null : window } = {}) {
  const validated = validateExternalUrl(value, hostConfiguration);
  if (!validated.ok || !windowObject?.open) return false;
  const opened = windowObject.open(validated.url, target === "_self" ? "_self" : "_blank", "noopener,noreferrer");
  if (opened && typeof opened === "object") opened.opener = null;
  return true;
}

export { configuredHosts, hostIsAllowed };
