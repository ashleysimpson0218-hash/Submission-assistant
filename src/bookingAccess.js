export const BOOK_SCREENING_ACTION = "book-screening";

function normalizedScopeValue(value, limit = 160) {
  return String(value || "").trim().slice(0, limit);
}

export function canonicalBookingScope(scope = {}) {
  return JSON.stringify({
    action: normalizedScopeValue(scope.action || BOOK_SCREENING_ACTION, 40),
    workspaceId: normalizedScopeValue(scope.workspaceId, 80),
    leadId: normalizedScopeValue(scope.leadId, 120),
    candidateId: normalizedScopeValue(scope.candidateId || scope.leadId, 120),
    requisitionId: normalizedScopeValue(scope.requisitionId, 120),
    facilityId: normalizedScopeValue(scope.facilityId, 120),
    recruiterId: normalizedScopeValue(scope.recruiterId, 120),
  });
}

function bytesToHex(bytes) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function browserCrypto() {
  return typeof window !== "undefined" ? window.crypto : null;
}

export async function sha256Hex(value, cryptoImpl = browserCrypto()) {
  if (!cryptoImpl?.subtle) return "";
  const bytes = typeof TextEncoder !== "undefined"
    ? new TextEncoder().encode(String(value))
    : Uint8Array.from(unescape(encodeURIComponent(String(value))), (character) => character.charCodeAt(0));
  const digest = await cryptoImpl.subtle.digest("SHA-256", bytes);
  return bytesToHex(new Uint8Array(digest));
}

export async function issueBookingAccess(scope = {}, options = {}) {
  const cryptoImpl = options.cryptoImpl || browserCrypto();
  const now = options.now instanceof Date ? options.now : new Date();
  const canonicalScope = canonicalBookingScope(scope);
  const parsedScope = JSON.parse(canonicalScope);
  const complete = parsedScope.workspaceId
    && parsedScope.leadId
    && parsedScope.candidateId
    && parsedScope.requisitionId
    && parsedScope.facilityId
    && parsedScope.recruiterId
    && parsedScope.action === BOOK_SCREENING_ACTION;
  if (!complete || !cryptoImpl?.getRandomValues || !cryptoImpl?.subtle) return { rawToken: "", record: {} };

  const tokenBytes = new Uint8Array(32);
  cryptoImpl.getRandomValues(tokenBytes);
  const rawToken = bytesToHex(tokenBytes);
  const [tokenHash, scopeDigest] = await Promise.all([
    sha256Hex(rawToken, cryptoImpl),
    sha256Hex(`${rawToken}\n${canonicalScope}`, cryptoImpl),
  ]);
  if (!tokenHash || !scopeDigest) return { rawToken: "", record: {} };
  const issuedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)).toISOString();
  return {
    rawToken,
    record: {
      bookingAccessTokenHash: tokenHash,
      bookingAccessScope: parsedScope,
      bookingAccessScopeDigest: scopeDigest,
      bookingAccessIssuedAt: issuedAt,
      bookingAccessExpiresAt: expiresAt,
      bookingAccessRevokedAt: "",
      bookingAccessConsumedAt: "",
    },
  };
}
