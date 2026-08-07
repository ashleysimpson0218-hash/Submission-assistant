export function isFeatureFlagEnabled(settings = {}, key = "") {
  return Boolean(settings.featureFlags?.[key] ?? settings.flags?.[key] ?? false);
}
