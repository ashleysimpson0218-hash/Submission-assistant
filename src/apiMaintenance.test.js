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

describe("server maintenance guards", () => {
  const originalFlag = process.env.WELCOMEFLOW_MAINTENANCE_MODE;

  beforeEach(() => {
    jest.resetModules();
    process.env.WELCOMEFLOW_MAINTENANCE_MODE = "true";
  });

  afterAll(() => {
    if (originalFlag === undefined) delete process.env.WELCOMEFLOW_MAINTENANCE_MODE;
    else process.env.WELCOMEFLOW_MAINTENANCE_MODE = originalFlag;
  });

  test("book-screening returns 503 without initializing Supabase", async () => {
    jest.doMock("@supabase/supabase-js", () => {
      throw new Error("Supabase must not initialize in maintenance mode");
    });
    const handler = require("../api/book-screening");
    const res = responseRecorder();

    await handler({ method: "POST", query: {}, body: {} }, res);

    expect(res.statusCode).toBe(503);
    expect(JSON.parse(res.body)).toEqual({ error: "WelcomeFlow is temporarily unavailable." });
  });

  test("parse-resume returns 503 without loading parser dependencies", async () => {
    jest.doMock("pdf-parse", () => {
      throw new Error("Resume parsing must not initialize in maintenance mode");
    });
    const handler = require("../api/parse-resume");
    const res = responseRecorder();

    await handler({ method: "POST", body: {} }, res);

    expect(res.statusCode).toBe(503);
    expect(JSON.parse(res.body)).toEqual({ error: "WelcomeFlow is temporarily unavailable." });
  });

  test("send-email returns 503 without calling an email provider", async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(() => {
      throw new Error("Email sending must not run in maintenance mode");
    });
    const handler = require("../api/send-email");
    const res = responseRecorder();

    await handler({ method: "POST", body: {} }, res);

    expect(res.statusCode).toBe(503);
    expect(JSON.parse(res.body)).toEqual({ error: "WelcomeFlow is temporarily unavailable." });
    expect(global.fetch).not.toHaveBeenCalled();
    global.fetch = originalFetch;
  });
});
