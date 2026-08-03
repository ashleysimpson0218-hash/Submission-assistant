import fs from "fs";
import path from "path";

const appSource = fs.readFileSync(path.resolve(__dirname, "App.js"), "utf8");
const indexSource = fs.readFileSync(path.resolve(__dirname, "index.js"), "utf8");

test("acceptance mode never reads browser-local workspace values or uses them as cloud fallbacks", () => {
  const storedValueStart = appSource.indexOf("function loadStoredValue");
  const storedValueFunction = storedValueStart >= 0 ? appSource.slice(storedValueStart, storedValueStart + 700) : "";
  expect(storedValueFunction).toContain("ownerUatMode || acceptanceMode");
  expect(appSource).toContain("acceptanceMode ? null : localIntakeDraft");
  expect(appSource).toContain("acceptanceMode ? [] : localCalendarEvents");
  expect(appSource).toContain("acceptanceMode ? \"\" : localHotLeadWorkingReqId");
});

test("internal booking links require opaque random tokens and do not expose lead IDs", () => {
  const bookingLinkStart = appSource.indexOf("function bookingRequestLinkForLead");
  const bookingLinkFunction = bookingLinkStart >= 0 ? appSource.slice(bookingLinkStart, bookingLinkStart + 600) : "";
  expect(bookingLinkFunction).toMatch(/transientBookingTokens/);
  expect(bookingLinkFunction).toMatch(/\{64\}/);
  expect(bookingLinkFunction).not.toMatch(/lead\.id/);
  expect(appSource).not.toMatch(/bookingAccessToken:\s*Array\.from/);
  expect(appSource).toContain('key !== "bookingAccessToken"');
});

test("acceptance authentication is in-memory and never consumes the persistent login marker", () => {
  expect(appSource).toContain('useState(() => acceptanceMode || window.localStorage.getItem("welcomeflow-session") === "active")');
  expect(appSource).toContain('if (!acceptanceMode) window.localStorage.setItem("welcomeflow-session", "active")');
  expect(appSource).toContain('if (!acceptanceMode) window.localStorage.removeItem("welcomeflow-session")');
});

test("active application defaults contain no real recipient or personal contact values", () => {
  const prohibitedContacts = ["teamcenturion.com", ["ashley", "central54recruiting.com"].join("@"), [["Ashley", "simpson0218"].join(""), "gmail.com"].join("@")];
  prohibitedContacts.forEach((value) => expect(appSource.toLowerCase()).not.toContain(value.toLowerCase()));
});

test("production runtime errors render a generic message instead of stack details", () => {
  expect(indexSource).toContain("process.env.NODE_ENV === 'production'");
  expect(indexSource).toContain("safeRuntimeErrors");
  expect(indexSource).toContain("WelcomeFlow could not be loaded safely. Reload and try again.");
});
