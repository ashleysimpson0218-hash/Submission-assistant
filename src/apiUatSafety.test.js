function responseRecorder() {
  return { statusCode: 0, headers: {}, body: "", setHeader(name, value) { this.headers[name] = value; }, end(value = "") { this.body = value; } };
}

describe("Owner UAT external action guards", () => {
  const originalFlag = process.env.WELCOMEFLOW_UAT_EXTERNAL_ACTIONS_DISABLED;
  beforeEach(() => {
    jest.resetModules();
    process.env.WELCOMEFLOW_MAINTENANCE_MODE = "false";
    process.env.WELCOMEFLOW_UAT_EXTERNAL_ACTIONS_DISABLED = "true";
  });
  afterAll(() => {
    if (originalFlag === undefined) delete process.env.WELCOMEFLOW_UAT_EXTERNAL_ACTIONS_DISABLED;
    else process.env.WELCOMEFLOW_UAT_EXTERNAL_ACTIONS_DISABLED = originalFlag;
  });

  test("email API is blocked before provider access", async () => {
    global.fetch = jest.fn();
    const handler = require("../api/send-email");
    const res = responseRecorder();
    await handler({ method: "POST", body: {} }, res);
    expect(res.statusCode).toBe(503);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("booking API is blocked before Supabase access", async () => {
    const handler = require("../api/book-screening");
    const res = responseRecorder();
    await handler({ method: "POST", query: {}, body: {} }, res);
    expect(res.statusCode).toBe(503);
  });

  test("resume API is blocked before parser initialization", async () => {
    jest.doMock("pdf-parse", () => { throw new Error("parser must not load"); });
    const handler = require("../api/parse-resume");
    const res = responseRecorder();
    await handler({ method: "POST", body: {} }, res);
    expect(res.statusCode).toBe(503);
  });
});
