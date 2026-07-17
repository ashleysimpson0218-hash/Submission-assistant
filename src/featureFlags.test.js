import { isFeatureFlagEnabled } from "./featureFlags";

test("Communication Readiness is visible only when its setting is enabled", () => {
  expect(isFeatureFlagEnabled({ featureFlags: { communicationReadinessAudit: true } }, "communicationReadinessAudit")).toBe(true);
  expect(isFeatureFlagEnabled({ featureFlags: { communicationReadinessAudit: false } }, "communicationReadinessAudit")).toBe(false);
  expect(isFeatureFlagEnabled({}, "communicationReadinessAudit")).toBe(false);
});
