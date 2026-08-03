const mockRpc = jest.fn().mockResolvedValue({ data: true, error: null });

jest.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc: mockRpc }) }));

const { consumeSharedRateLimits } = require("../server/welcomeflowApiSecurity");

describe("multidimensional shared rate limits", () => {
  const originalEnv = { ...process.env };

  beforeAll(() => {
    process.env.SUPABASE_URL = "https://abcdefghijklmnopqrst.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "server-secret-key";
  });

  afterAll(() => { process.env = originalEnv; });
  beforeEach(() => mockRpc.mockReset().mockResolvedValue({ data: true, error: null }));

  test("hashes account and IP dimensions before the atomic RPC", async () => {
    const result = await consumeSharedRateLimits({ action: "send-email", subjects: ["user:user-1", "ip:203.0.113.20"], limit: 10 });
    expect(result).toMatchObject({ ok: true });
    const [name, args] = mockRpc.mock.calls[0];
    expect(name).toBe("welcomeflow_consume_api_rate_limits");
    expect(args.p_subject_hashes).toHaveLength(2);
    expect(args.p_subject_hashes).toEqual([...args.p_subject_hashes].sort());
    args.p_subject_hashes.forEach((hash) => expect(hash).toMatch(/^[a-f0-9]{64}$/));
    expect(JSON.stringify(args)).not.toMatch(/user-1|203\.0\.113\.20/);
  });

  test("keeps a shared IP dimension across accounts and a shared account dimension across IPs", async () => {
    await consumeSharedRateLimits({ action: "send-email", subjects: ["user:user-a", "ip:203.0.113.30"], limit: 10 });
    await consumeSharedRateLimits({ action: "send-email", subjects: ["user:user-b", "ip:203.0.113.30"], limit: 10 });
    await consumeSharedRateLimits({ action: "send-email", subjects: ["user:user-a", "ip:203.0.113.31"], limit: 10 });
    const [first, second, third] = mockRpc.mock.calls.map((call) => new Set(call[1].p_subject_hashes));
    expect([...first].filter((hash) => second.has(hash))).toHaveLength(1);
    expect([...first].filter((hash) => third.has(hash))).toHaveLength(1);
  });

  test("fails closed without at least two independent dimensions", async () => {
    await expect(consumeSharedRateLimits({ action: "send-email", subjects: ["user:user-a"], limit: 10 })).resolves.toMatchObject({ ok: false, unavailable: true });
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
