const mockRpc = jest.fn().mockResolvedValue({ data: true, error: null });

jest.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc: mockRpc }) }));

const {
  consumePreAuthenticationRateLimit,
  requestIp,
} = require("../server/welcomeflowApiSecurity");

describe("shared pre-authentication rate limiting", () => {
  const originalEnv = { ...process.env };

  beforeAll(() => {
    process.env.SUPABASE_URL = "https://abcdefghijklmnopqrst.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "server-secret-key";
    delete process.env.VERCEL;
  });

  afterAll(() => { process.env = originalEnv; });
  beforeEach(() => {
    delete process.env.VERCEL;
    mockRpc.mockReset().mockResolvedValue({ data: true, error: null });
  });

  const directRequest = (ip, authorization = "") => ({
    headers: { authorization },
    socket: { remoteAddress: ip },
  });

  test("ignores caller-provided forwarding headers outside a trusted Vercel request", () => {
    expect(requestIp({
      headers: { "x-forwarded-for": "198.51.100.99" },
      socket: { remoteAddress: "203.0.113.40" },
    })).toBe("203.0.113.40");
  });

  test("uses Vercel-provided client IP on a trusted direct Vercel request", () => {
    process.env.VERCEL = "1";
    expect(requestIp({
      headers: { "x-forwarded-for": "198.51.100.50, 10.0.0.1" },
      socket: { remoteAddress: "127.0.0.1" },
    })).toBe("198.51.100.50");
    delete process.env.VERCEL;
  });

  test("hashes the source IP before the shared atomic RPC", async () => {
    await consumePreAuthenticationRateLimit(directRequest("203.0.113.41"), { action: "send-email", limit: 10 });
    const args = mockRpc.mock.calls[0][1];
    expect(args.p_action).toBe("send-email-preauth");
    expect(args.p_subject_hashes).toHaveLength(2);
    args.p_subject_hashes.forEach((hash) => expect(hash).toMatch(/^[a-f0-9]{64}$/));
    expect(JSON.stringify(args)).not.toMatch(/203\.0\.113\.41/);
  });

  test("multiple invalid tokens from one IP consume the same IP dimensions", async () => {
    await consumePreAuthenticationRateLimit(directRequest("203.0.113.42", "Bearer bad-one"), { action: "send-email", limit: 10 });
    await consumePreAuthenticationRateLimit(directRequest("203.0.113.42", "Bearer bad-two"), { action: "send-email", limit: 10 });
    expect(mockRpc.mock.calls[0][1].p_subject_hashes).toEqual(mockRpc.mock.calls[1][1].p_subject_hashes);
  });

  test("the same invalid token from different IPs consumes different dimensions", async () => {
    await consumePreAuthenticationRateLimit(directRequest("203.0.113.43", "Bearer shared-bad"), { action: "parse-resume", limit: 10 });
    await consumePreAuthenticationRateLimit(directRequest("203.0.113.44", "Bearer shared-bad"), { action: "parse-resume", limit: 10 });
    expect(mockRpc.mock.calls[0][1].p_subject_hashes).not.toEqual(mockRpc.mock.calls[1][1].p_subject_hashes);
  });

  test("fails closed when the shared limiter is unavailable", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: new Error("unavailable") });
    await expect(consumePreAuthenticationRateLimit(directRequest("203.0.113.45"), {
      action: "send-email",
      limit: 10,
    })).resolves.toMatchObject({ ok: false, unavailable: true });
  });
});
