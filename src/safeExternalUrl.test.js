import { openApprovedExternalUrl, validateExternalUrl } from "./safeExternalUrl";

test("allows only HTTPS URLs on explicitly configured hosts", () => {
  expect(validateExternalUrl("https://calendly.com/synthetic-recruiter/meeting", "calendly.com")).toMatchObject({ ok: true, hostname: "calendly.com" });
  expect(validateExternalUrl("http://calendly.com/synthetic", "calendly.com").ok).toBe(false);
  expect(validateExternalUrl("https://evil.example/?next=calendly.com", "calendly.com").ok).toBe(false);
});

test("requires explicit wildcard configuration for subdomains", () => {
  expect(validateExternalUrl("https://team.calendly.com/meeting", "calendly.com").ok).toBe(false);
  expect(validateExternalUrl("https://team.calendly.com/meeting", "*.calendly.com").ok).toBe(true);
  expect(validateExternalUrl("https://calendly.com/meeting", "*.calendly.com").ok).toBe(false);
});

test.each([
  "javascript:alert(1)",
  "data:text/html,unsafe",
  "ftp://calendly.com/file",
  ["https://user:password", "calendly.com/meeting"].join("@"),
  "//calendly.com/meeting",
])("rejects dangerous or ambiguous URL %s", (value) => {
  expect(validateExternalUrl(value, "calendly.com").ok).toBe(false);
});

test("opens approved links with opener protection and fails closed otherwise", () => {
  const popup = { opener: { unsafe: true } };
  const windowObject = { open: jest.fn(() => popup) };
  expect(openApprovedExternalUrl("https://calendly.com/synthetic", { hostConfiguration: "calendly.com", windowObject })).toBe(true);
  expect(windowObject.open).toHaveBeenCalledWith("https://calendly.com/synthetic", "_blank", "noopener,noreferrer");
  expect(popup.opener).toBeNull();
  expect(openApprovedExternalUrl("https://evil.example/", { hostConfiguration: "calendly.com", windowObject })).toBe(false);
  expect(windowObject.open).toHaveBeenCalledTimes(1);
});

test("empty configuration denies every external URL", () => {
  expect(validateExternalUrl("https://calendly.com/synthetic", "").ok).toBe(false);
});
