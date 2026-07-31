function responseRecorder() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    setHeader(name, value) { this.headers[name] = value; },
    end(value = "") { this.body = value; },
  };
}

function configureSupabase(rateResult = true) {
  const rpc = jest.fn().mockResolvedValue({ data: rateResult, error: null });
  jest.doMock("@supabase/supabase-js", () => ({
    createClient: jest.fn((url, key) => key === "server-secret-key"
      ? { rpc }
      : { auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }) } }),
  }));
  return rpc;
}

function resumeRequest(body = {}, authorization = "Bearer valid-token") {
  const text = Buffer.from("Synthetic Candidate\nsynthetic@example.test\nRegistered Nurse", "utf8");
  return {
    method: "POST",
    headers: { authorization },
    body: {
      filename: "synthetic-resume.txt",
      mimeType: "text/plain",
      size: text.length,
      base64: text.toString("base64"),
      ...body,
    },
  };
}

describe("resume parser authentication and abuse protection", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env.WELCOMEFLOW_MAINTENANCE_MODE = "false";
    process.env.WELCOMEFLOW_UAT_EXTERNAL_ACTIONS_DISABLED = "false";
    process.env.SUPABASE_URL = "https://abcdefghijklmnopqrst.supabase.co";
    process.env.SUPABASE_ANON_KEY = "publishable-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "server-secret-key";
    process.env.RESUME_PARSER_PROVIDER = "local";
    process.env.WELCOMEFLOW_RESUME_RATE_LIMIT_PER_MINUTE = "6";
  });

  afterAll(() => { process.env = originalEnv; jest.restoreAllMocks(); });

  test("rejects an unauthenticated parser request before parsing", async () => {
    const handler = require("../api/parse-resume");
    const res = responseRecorder();
    await handler(resumeRequest({}, ""), res);
    expect(res.statusCode).toBe(401);
  });

  test("parses a bounded text resume for an authenticated user", async () => {
    const rpc = configureSupabase(true);
    const handler = require("../api/parse-resume");
    const res = responseRecorder();
    await handler(resumeRequest(), res);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ ok: true, provider: "WelcomeFlow Local Parser" });
    expect(rpc).toHaveBeenCalledWith("welcomeflow_consume_api_rate_limit", expect.objectContaining({ p_action: "parse-resume", p_subject: "user:user-1" }));
  });

  test("fails closed when the shared limiter denies a request", async () => {
    configureSupabase(false);
    const handler = require("../api/parse-resume");
    const res = responseRecorder();
    await handler(resumeRequest(), res);
    expect(res.statusCode).toBe(429);
  });

  test("rejects a payload whose claimed size differs from decoded content", async () => {
    configureSupabase(true);
    const handler = require("../api/parse-resume");
    const res = responseRecorder();
    await handler(resumeRequest({ size: 1 }), res);
    expect(res.statusCode).toBe(413);
    expect(res.body).toMatch(/size validation/i);
  });

  test("rejects an oversized request before authentication or parser initialization", async () => {
    const handler = require("../api/parse-resume");
    const res = responseRecorder();
    const req = resumeRequest({}, "");
    req.headers["content-length"] = String(12 * 1024 * 1024);
    await handler(req, res);
    expect(res.statusCode).toBe(413);
  });
});
