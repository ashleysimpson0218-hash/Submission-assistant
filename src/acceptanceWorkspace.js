function records(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value);
  return [];
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function utf8Bytes(value) {
  const bytes = [];
  for (let index = 0; index < value.length; index += 1) {
    let code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      code = 0x10000 + ((code - 0xd800) << 10) + (value.charCodeAt(index + 1) - 0xdc00);
      index += 1;
    }
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
  }
  return Uint8Array.from(bytes);
}

export async function workspaceFingerprint(workspace, cryptoApi = typeof window !== "undefined" ? window.crypto : null) {
  if (!cryptoApi?.subtle) throw new Error("Secure workspace fingerprinting is unavailable.");
  const bytes = utf8Bytes(canonicalJson(workspace));
  const digest = await cryptoApi.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

export function workspaceCounts(workspace = {}) {
  const settings = workspace.settings || {};
  return {
    candidates: records(workspace.tracker).length,
    facilities: records(settings.sites).length,
    requisitions: records(settings.requisitions).length,
    history: records(workspace.history).length,
    reportHistory: records(workspace.reportHistory).length,
    hotLeads: records(workspace.hotLeads).length,
    intakeDrafts: records(workspace.intakeDrafts).length,
    regionalContacts: records(settings.contacts).filter((contact) => records(contact.assignedFacilityIds).length || /regional|area/i.test(String(contact.contactRole || contact.title || ""))).length,
  };
}

export function verifyAcceptanceWorkspace({ workspaceId, expectedCounts = {}, expectedFingerprint = "", actualCounts = {}, actualFingerprint = "" } = {}) {
  const mismatches = [];
  Object.entries(expectedCounts).forEach(([field, expected]) => {
    if (expected !== null && expected !== undefined && actualCounts[field] !== expected) {
      mismatches.push(`${field}: expected ${expected}, loaded ${actualCounts[field] ?? "unavailable"}`);
    }
  });
  if (expectedFingerprint && expectedFingerprint.toLowerCase() !== String(actualFingerprint).toLowerCase()) {
    mismatches.push("workspace fingerprint does not match the approved fixture");
  }
  return {
    ok: Boolean(workspaceId) && mismatches.length === 0,
    mismatches,
    message: mismatches.length ? `Workspace verification failed: ${mismatches.join("; ")}.` : `Workspace ${workspaceId} matches the approved acceptance fixture.`,
  };
}
