function normalizedCode(value) {
  return String(value || "SERVER_ACTION_FAILED").replace(/[^A-Z0-9_]/gi, "_").toUpperCase().slice(0, 80);
}

function reportServerFailure(code, error, metadata = {}) {
  const safeMetadata = {};
  if (Number.isInteger(metadata.status)) safeMetadata.status = metadata.status;
  if (metadata.provider) safeMetadata.provider = String(metadata.provider).replace(/[^a-z0-9_-]/gi, "").slice(0, 40);
  const category = error instanceof TypeError ? "TypeError" : error instanceof RangeError ? "RangeError" : "Error";
  console.error("WelcomeFlow server action failed", { code: normalizedCode(code), category, ...safeMetadata });
}

module.exports = { reportServerFailure };
