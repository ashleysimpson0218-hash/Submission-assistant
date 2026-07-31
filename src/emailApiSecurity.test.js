function responseRecorder() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(value = "") {
      this.body = value;
    },
  };
}

function authorizedSupabase(user = { id: "user-1", email: "recruiter@example.test" }, rateResults = [true]) {
  const rpc = jest.fn();
  rateResults.forEach((result) => rpc.mockResolvedValueOnce({ data: result, error: null }));
  jest.doMock("@supabase/supabase-js", () => ({
    createClient: jest.fn((url, key) => key === "server-secret-key"
      ? { rpc }
      : { auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }) } }),
  }));
  return rpc;
}

function request(body = {}, authorization = "Bearer valid-token") {
  return {
    method: "POST",
    headers: { authorization },
    body,
  };
}

describe("email API authorization and abuse protection", () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetModules();
    process.env.WELCOMEFLOW_MAINTENANCE_MODE = "false";
    process.env.WELCOMEFLOW_UAT_EXTERNAL_ACTIONS_DISABLED = "false";
    process.env.SUPABASE_URL = "https://abcdefghijklmnopqrst.supabase.co";
    process.env.SUPABASE_ANON_KEY = "publishable-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "server-secret-key";
    process.env.RESEND_API_KEY = "resend-key";
    process.env.RESEND_FROM_EMAIL = "sender@example.test";
    process.env.WELCOMEFLOW_EMAIL_ALLOWED_RECIPIENTS = "recruiter@example.test";
    process.env.WELCOMEFLOW_EMAIL_ALLOWED_DOMAINS = "example.test";
    process.env.WELCOMEFLOW_EMAIL_RATE_LIMIT_PER_MINUTE = "10";
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ id: "email-1" }),
    });
  });

  afterAll(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test("rejects missing authorization before provider access", async () => {
    const handler = require("../api/send-email");
    const res = responseRecorder();
    await handler(request({ to: "recruiter@example.test", subject: "Subject", body: "Body" }, ""), res);
    expect(res.statusCode).toBe(401);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("rejects invalid or expired authorization before provider access", async () => {
    jest.doMock("@supabase/supabase-js", () => ({
      createClient: jest.fn((url, key) => key === "server-secret-key"
        ? { rpc: jest.fn() }
        : { auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: new Error("expired") }) } }),
    }));
    const handler = require("../api/send-email");
    const res = responseRecorder();
    await handler(request({ to: "recruiter@example.test", subject: "Subject", body: "Body" }), res);
    expect(res.statusCode).toBe(401);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("rejects recipients outside the configured server policy", async () => {
    authorizedSupabase();
    const handler = require("../api/send-email");
    const res = responseRecorder();
    await handler(request({ to: "outside@unapproved.invalid", subject: "Subject", body: "Body" }), res);
    expect(res.statusCode).toBe(403);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("rejects oversized payloads before authorization or provider access", async () => {
    const handler = require("../api/send-email");
    const res = responseRecorder();
    await handler({
      ...request({ to: "recruiter@example.test", subject: "Subject", body: "Body" }),
      headers: { authorization: "Bearer valid-token", "content-length": String(70 * 1024) },
    }, res);
    expect(res.statusCode).toBe(413);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("rejects malformed JSON after authorization without provider access", async () => {
    authorizedSupabase();
    const handler = require("../api/send-email");
    const res = responseRecorder();
    await handler(request("{not-json"), res);
    expect(res.statusCode).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("sends a bounded request for an authorized user and approved recipient", async () => {
    authorizedSupabase();
    const handler = require("../api/send-email");
    const res = responseRecorder();
    await handler(request({ to: "recruiter@example.test", subject: "Approved subject", body: "Approved body" }), res);
    expect(res.statusCode).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const providerRequest = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(providerRequest).toMatchObject({ to: ["recruiter@example.test"], subject: "Approved subject", text: "Approved body" });
  });

  test("sanitizes provider failures without returning provider details", async () => {
    authorizedSupabase();
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: jest.fn().mockResolvedValue({ message: "provider-secret-detail", internal: "do-not-return" }),
    });
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const handler = require("../api/send-email");
    const res = responseRecorder();
    await handler(request({ to: "recruiter@example.test", subject: "Subject", body: "Body" }), res);
    expect(res.statusCode).toBe(502);
    expect(res.body).not.toMatch(/provider-secret-detail|do-not-return/);
    expect(errorSpy).toHaveBeenCalledWith("WelcomeFlow email provider rejected a request", expect.objectContaining({ status: 422, userId: "user-1" }));
  });

  test("rate limits repeated requests from the same verified user", async () => {
    process.env.WELCOMEFLOW_EMAIL_RATE_LIMIT_PER_MINUTE = "1";
    const rpc = authorizedSupabase(undefined, [true, false]);
    const handler = require("../api/send-email");
    const first = responseRecorder();
    const second = responseRecorder();
    await handler(request({ to: "recruiter@example.test", subject: "First", body: "Body" }), first);
    await handler(request({ to: "recruiter@example.test", subject: "Second", body: "Body" }), second);
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(429);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  test("fails closed when shared rate limiting is unavailable", async () => {
    jest.doMock("@supabase/supabase-js", () => ({
      createClient: jest.fn((url, key) => key === "server-secret-key"
        ? { rpc: jest.fn().mockResolvedValue({ data: null, error: new Error("missing function") }) }
        : { auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }) } }),
    }));
    const handler = require("../api/send-email");
    const res = responseRecorder();
    await handler(request({ to: "recruiter@example.test", subject: "Subject", body: "Body" }), res);
    expect(res.statusCode).toBe(503);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
