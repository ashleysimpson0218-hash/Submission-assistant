export function savedDraftText(value) {
  return String(value ?? "");
}

export function trimmedSavedDraftText(value) {
  return savedDraftText(value).trim();
}

export function normalizedSavedDraftText(value) {
  return trimmedSavedDraftText(value).toLowerCase();
}

export function savedDraftPhoneDigits(value) {
  return savedDraftText(value).replace(/\D/g, "");
}

export function savedDraftArray(value) {
  return Array.isArray(value) ? value : [];
}

export function readSavedIntakeDraftIdentity(form) {
  const source = form && typeof form === "object" ? form : {};
  return {
    fullName: trimmedSavedDraftText(source.fullName),
    emailAddress: trimmedSavedDraftText(source.emailAddress),
    normalizedName: normalizedSavedDraftText(source.fullName),
    normalizedEmail: normalizedSavedDraftText(source.emailAddress),
    phoneDigits: savedDraftPhoneDigits(source.phoneNumber),
  };
}
