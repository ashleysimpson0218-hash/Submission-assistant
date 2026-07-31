import fs from "fs";
import path from "path";

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

function workspaceData(leadPatch = {}) {
  return {
    hotLeads: [{
      id: "lead-1",
      candidateName: "Synthetic Candidate",
      email: "candidate@example.test",
      phone: "555-0101",
      selectedFacility: "Synthetic Facility",
      selectedRequisitionId: "req-1",
      ...leadPatch,
    }],
    settings: { requisitions: { one: { id: "req-1", reqNumber: "SYN-1001" } } },
    unrelatedRecruiterState: { keep: true, revision: 7 },
  };
}

function mockClient({ data = workspaceData(), updatedAt = "2026-07-30T12:00:00.000Z", conflict = false } = {}) {
  const state = {
    row: { data, updated_at: updatedAt },
    updates: [],
    conflict,
  };
  const client = {
    from: jest.fn(() => {
      let mode = "select";
      let updatePayload = null;
      const filters = {};
      const builder = {
        select: jest.fn(() => builder),
        update: jest.fn((payload) => {
          mode = "update";
          updatePayload = payload;
          return builder;
        }),
        eq: jest.fn((field, value) => {
          filters[field] = value;
          return builder;
        }),
        maybeSingle: jest.fn(async () => {
          if (mode === "select") return { data: state.row, error: null };
          state.updates.push({ payload: updatePayload, filters });
          if (state.conflict || filters.updated_at !== state.row.updated_at) return { data: null, error: null };
          state.row = { ...state.row, ...updatePayload };
          return { data: { updated_at: updatePayload.updated_at }, error: null };
        }),
      };
      return builder;
    }),
  };
  return { client, state };
}

function bookingRequest(body = {}, workspaceId = "phase1-booking-test") {
  return {
    method: "POST",
    headers: {},
    query: { workspaceId, leadId: "lead-1" },
    body: {
      workspaceId,
      leadId: "lead-1",
      requisitionId: "req-1",
      requestedDate: "2099-07-30",
      requestedTime: "10:30",
      meetingType: "Phone",
      ...body,
    },
  };
}

describe("booking API optimistic concurrency", () => {
  const originalEnv = { ...process.env };
  let currentClient;

  beforeEach(() => {
    jest.resetModules();
    process.env.WELCOMEFLOW_MAINTENANCE_MODE = "false";
    process.env.WELCOMEFLOW_UAT_EXTERNAL_ACTIONS_DISABLED = "false";
    process.env.SUPABASE_URL = "https://abcdefghijklmnopqrst.supabase.co";
    process.env.SUPABASE_ANON_KEY = "publishable-key";
    process.env.WELCOMEFLOW_BOOKING_WORKSPACE_IDS = "phase1-booking-test";
    jest.doMock("@supabase/supabase-js", () => ({ createClient: jest.fn(() => currentClient) }));
  });

  afterAll(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  test("saves a valid booking with an updated_at compare-and-swap and preserves unrelated content", async () => {
    const fixture = mockClient();
    currentClient = fixture.client;
    const handler = require("../api/book-screening");
    const res = responseRecorder();
    await handler(bookingRequest(), res);
    expect(res.statusCode).toBe(200);
    expect(fixture.state.updates).toHaveLength(1);
    expect(fixture.state.updates[0].filters).toMatchObject({
      workspace_id: "phase1-booking-test",
      updated_at: "2026-07-30T12:00:00.000Z",
    });
    expect(fixture.state.row.data.unrelatedRecruiterState).toEqual({ keep: true, revision: 7 });
    expect(fixture.state.row.data.hotLeads[0]).toMatchObject({
      id: "lead-1",
      candidateName: "Synthetic Candidate",
      bookedScreeningDate: "2099-07-30",
      bookedScreeningTime: "10:30",
      bookingStatus: "Requested",
    });
  });

  test("treats an identical repeated booking as idempotent", async () => {
    const fixture = mockClient({
      data: workspaceData({
        bookedScreeningDate: "2099-07-30",
        bookedScreeningTime: "10:30",
        bookingStatus: "Requested",
      }),
    });
    currentClient = fixture.client;
    const handler = require("../api/book-screening");
    const res = responseRecorder();
    await handler(bookingRequest(), res);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ ok: true, duplicate: true });
    expect(fixture.state.updates).toHaveLength(0);
  });

  test("returns a conflict instead of overwriting a concurrent recruiter update", async () => {
    const fixture = mockClient({ conflict: true });
    currentClient = fixture.client;
    const handler = require("../api/book-screening");
    const res = responseRecorder();
    await handler(bookingRequest(), res);
    expect(res.statusCode).toBe(409);
    expect(res.body).toMatch(/workspace changed/i);
    expect(fixture.state.row.data.unrelatedRecruiterState).toEqual({ keep: true, revision: 7 });
  });

  test("rejects a workspace outside the exact server allowlist", async () => {
    const fixture = mockClient();
    currentClient = fixture.client;
    const handler = require("../api/book-screening");
    const res = responseRecorder();
    await handler(bookingRequest({}, "unapproved-workspace"), res);
    expect(res.statusCode).toBe(403);
    expect(fixture.client.from).not.toHaveBeenCalled();
  });

  test.each([
    [{ leadId: "different-lead" }, /candidate/i],
    [{ requisitionId: "different-req" }, /requisition/i],
    [{ requestedDate: "2099-02-30" }, /valid date/i],
    [{ requestedTime: "25:99" }, /valid date/i],
  ])("rejects invalid candidate, requisition, or slot context", async (patch, message) => {
    const fixture = mockClient();
    currentClient = fixture.client;
    const handler = require("../api/book-screening");
    const res = responseRecorder();
    await handler(bookingRequest(patch), res);
    expect(res.statusCode).toBe(400 + (patch.leadId || patch.requisitionId ? 9 : 0));
    expect(res.body).toMatch(message);
    expect(fixture.state.updates).toHaveLength(0);
  });

  test("never bypasses optimistic concurrency with a blind workspace upsert", () => {
    const source = fs.readFileSync(path.resolve(__dirname, "..", "api", "book-screening.js"), "utf8");
    expect(source).not.toMatch(/\.upsert\s*\(/);
    expect(source).toMatch(/\.eq\("updated_at",\s*expectedUpdatedAt\)/);
  });
});
