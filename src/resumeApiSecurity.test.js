function responseRecorder() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    setHeader(name, value) { this.headers[name] = value; },
    end(value = "") { this.body = value; },
  };
}

function configureSupabase(rateResult = true, user = {
  id: "user-1",
  app_metadata: { welcomeflow_role: "recruiter", welcomeflow_workspace_ids: ["workspace-1"] },
}) {
  const rpc = jest.fn().mockResolvedValue({ data: rateResult, error: null });
  jest.doMock("@supabase/supabase-js", () => ({
    createClient: jest.fn((url, key) => key === "server-secret-key"
      ? { rpc }
      : { auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }) } }),
  }));
  return rpc;
}

function resumeRequest(body = {}, authorization = "Bearer valid-token") {
  const text = Buffer.from("Synthetic Candidate\nsynthetic@example.test\nRegistered Nurse", "utf8");
  return {
    method: "POST",
    headers: { authorization, "x-welcomeflow-workspace-id": "workspace-1", "x-forwarded-for": "203.0.113.20" },
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
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetModules();
    process.env.WELCOMEFLOW_MAINTENANCE_MODE = "false";
    process.env.WELCOMEFLOW_UAT_EXTERNAL_ACTIONS_DISABLED = "false";
    process.env.SUPABASE_URL = "https://abcdefghijklmnopqrst.supabase.co";
    process.env.SUPABASE_ANON_KEY = "publishable-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "server-secret-key";
    process.env.RESUME_PARSER_PROVIDER = "local";
    process.env.WELCOMEFLOW_RESUME_RATE_LIMIT_PER_MINUTE = "6";
    process.env.WELCOMEFLOW_AUTHORIZED_RECRUITER_ROLES = "recruiter,admin";
    process.env.WELCOMEFLOW_API_WORKSPACE_IDS = "workspace-1";
    delete process.env.AFFINDA_API_KEY;
  });

  afterAll(() => { process.env = originalEnv; global.fetch = originalFetch; jest.restoreAllMocks(); });

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
    expect(rpc).toHaveBeenCalledWith("welcomeflow_consume_api_rate_limits", expect.objectContaining({
      p_action: "parse-resume",
      p_subject_hashes: expect.arrayContaining([expect.stringMatching(/^[a-f0-9]{64}$/)]),
    }));
    const rateArguments = rpc.mock.calls[0][1];
    expect(rateArguments.p_subject_hashes).toHaveLength(2);
    expect(JSON.stringify(rateArguments)).not.toMatch(/user-1|203\.0\.113\.20/);
  });

  test("rejects a valid user without the recruiter role", async () => {
    configureSupabase(true, { id: "user-2", app_metadata: { welcomeflow_workspace_ids: ["workspace-1"] } });
    const handler = require("../api/parse-resume");
    const res = responseRecorder();
    await handler(resumeRequest(), res);
    expect(res.statusCode).toBe(403);
  });

  test("rejects a recruiter who is not a member of the requested workspace", async () => {
    configureSupabase(true, { id: "user-3", app_metadata: { welcomeflow_role: "recruiter", welcomeflow_workspace_ids: ["workspace-2"] } });
    const handler = require("../api/parse-resume");
    const res = responseRecorder();
    await handler(resumeRequest(), res);
    expect(res.statusCode).toBe(403);
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

  test("rejects a signature mismatch before Affinda receives any file bytes", async () => {
    configureSupabase(true);
    process.env.RESUME_PARSER_PROVIDER = "affinda";
    process.env.AFFINDA_API_KEY = "server-provider-key";
    global.fetch = jest.fn();
    const handler = require("../api/parse-resume");
    const res = responseRecorder();
    await handler(resumeRequest({ filename: "renamed.pdf", mimeType: "application/pdf" }), res);
    expect(res.statusCode).toBe(415);
    expect(JSON.parse(res.body)).toMatchObject({ code: "RESUME_FILE_SIGNATURE_INVALID" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("rejects mismatched extension and MIME before selecting a parser", async () => {
    configureSupabase(true);
    const handler = require("../api/parse-resume");
    const res = responseRecorder();
    await handler(resumeRequest({ filename: "resume.pdf", mimeType: "text/plain", base64: Buffer.from("%PDF-1.7").toString("base64"), size: 8 }), res);
    expect(res.statusCode).toBe(415);
    expect(JSON.parse(res.body)).toMatchObject({ code: "RESUME_FILE_TYPE_MISMATCH" });
  });
});
