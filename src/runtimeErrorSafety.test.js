import fs from "fs";
import path from "path";
import { safeActionFailure } from "./runtimeErrors";

const { reportServerFailure } = require("../server/safeServerError");

test("client action failures expose only fixed safe text and stable diagnostics", () => {
  const spy = jest.spyOn(console, "error").mockImplementation(() => {});
  const message = safeActionFailure("submission failed", "The submission could not be generated safely.", new Error("database password and candidate details"));
  expect(message).toBe("The submission could not be generated safely.");
  expect(JSON.stringify(spy.mock.calls)).not.toMatch(/database password|candidate details/);
  expect(spy).toHaveBeenCalledWith("WelcomeFlow action failed", { code: "SUBMISSION_FAILED", category: "Error" });
  spy.mockRestore();
});

test("server diagnostics never log raw exception messages or identifiers", () => {
  const spy = jest.spyOn(console, "error").mockImplementation(() => {});
  reportServerFailure("provider failed", new Error("secret provider body for candidate-123"), { status: 502, provider: "resend", userId: "user-1" });
  expect(spy).toHaveBeenCalledWith("WelcomeFlow server action failed", { code: "PROVIDER_FAILED", category: "Error", status: 502, provider: "resend" });
  expect(JSON.stringify(spy.mock.calls)).not.toMatch(/secret provider body|candidate-123|user-1/);
  spy.mockRestore();
});

test("reviewed action catch paths do not interpolate raw Error messages into the UI", () => {
  const app = fs.readFileSync(path.resolve(__dirname, "App.js"), "utf8");
  expect(app).not.toMatch(/setCopyNotice\([^\n]*(?:error\?\.message|error\.message)/);
  expect(app).not.toMatch(/setCommunicationSaveError\([^\n]*(?:error\?\.message|error\.message)/);
  expect(app).toContain("The communication action was blocked safely. No status was changed.");
});
