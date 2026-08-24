import fs from "fs";
import path from "path";
import crypto from "crypto";

const BOOKING_TOKEN = "a".repeat(64);

function responseRecorder() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    setHeader(name, value) { this.headers[name] = value; },
    end(value = "") { this.body = value; },
  };
}

function workspaceData(leadPatch = {}, requisitionPatch = {}) {
  const scope = {
    action: "book-screening",
    workspaceId: "phase1-booking-test",
    leadId: "lead-1",
    candidateId: "lead-1",
    requisitionId: "req-1",
    facilityId: "facility-1",
    recruiterId: "recruiter-1",
  };
  return {
    hotLeads: [{
      id: "lead-1",
      leadId: "lead-1",
      bookingAccessTokenHash: crypto.createHash("sha256").update(BOOKING_TOKEN).digest("hex"),
      bookingAccessScope: scope,
      bookingAccessScopeDigest: crypto.createHash("sha256").update(`${BOOKING_TOKEN}\n${JSON.stringify(scope)}`).digest("hex"),
      bookingAccessIssuedAt: "2026-07-01T12:00:00.000Z",
      bookingAccessExpiresAt: "2026-08-30T12:00:00.000Z",
      bookingAccessRevokedAt: "",
      bookingAccessConsumedAt: "",
      status: "Booking Link Sent",
      candidateName: "Synthetic Candidate",
      email: "candidate@example.test",
      phone: "555-0101",
      selectedFacility: "Synthetic Facility",
      facilityId: "facility-1",
      recruiterOwner: "recruiter-1",
      selectedRequisitionId: "req-1",
      ...leadPatch,
    }],
    settings: {
      requisitions: { one: { id: "req-1", reqNumber: "SYN-1001", facilityId: "facility-1", status: "Active", ...requisitionPatch } },
      general: { recruiterName: "Synthetic Recruiter", companyName: "Synthetic Company" },
    },
    unrelatedRecruiterState: { keep: true, revision: 7 },
  };
}

function mockClient({ data = workspaceData(), updatedAt = "2026-07-30T12:00:00.000Z", conflict = false, rateAllowed = true, reservationResult = "booked" } = {}) {
  const state = { row: { data, updated_at: updatedAt }, updates: [], reservations: [], conflict };
  const client = {
    rpc: jest.fn(async (name, args) => {
      if (name === "welcomeflow_consume_api_rate_limits") return { data: rateAllowed, error: null };
      if (name === "welcomeflow_reserve_screening_slot") {
        state.reservations.push(args);
        const result = conflict ? "conflict" : reservationResult;
        if (result === "booked") state.row = { data: args.p_next_data, updated_at: args.p_next_updated_at };
        return { data: result, error: null };
      }
      return { data: null, error: new Error("unexpected RPC") };
    }),
    from: jest.fn(() => {
      let mode = "select";
      let updatePayload = null;
      const filters = {};
      const builder = {
        select: jest.fn(() => builder),
        update: jest.fn((payload) => { mode = "update"; updatePayload = payload; return builder; }),
        eq: jest.fn((field, value) => { filters[field] = value; return builder; }),
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

function bookingRequest(body = {}, workspaceId = "phase1-booking-test", method = "POST") {
  return {
    method,
    headers: { "x-forwarded-for": "203.0.113.10" },
    query: { workspaceId, token: BOOKING_TOKEN },
    body: method === "POST" ? {
      workspaceId,
      token: BOOKING_TOKEN,
      requestedDate: "2026-07-31",
      requestedTime: "10:30",
      meetingType: "Phone",
      preferredContactMethod: "Email",
      ...body,
    } : undefined,
  };
}

describe("booking API secure public scheduling", () => {
  const originalEnv = { ...process.env };
  let currentClient;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers().setSystemTime(new Date("2026-07-30T16:00:00.000Z"));
    process.env.WELCOMEFLOW_MAINTENANCE_MODE = "false";
    process.env.WELCOMEFLOW_UAT_EXTERNAL_ACTIONS_DISABLED = "false";
    process.env.SUPABASE_URL = "https://abcdefghijklmnopqrst.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "server-secret-key";
    process.env.WELCOMEFLOW_SERVER_ENV = "test";
    process.env.WELCOMEFLOW_ALLOWED_SUPABASE_PROJECT_REF = "abcdefghijklmnopqrst";
    process.env.WELCOMEFLOW_ENABLE_BOOKING_ACTIONS = "true";
    process.env.WELCOMEFLOW_BOOKING_WORKSPACE_IDS = "phase1-booking-test";
    process.env.WELCOMEFLOW_BOOKING_ALLOWED_SLOTS = "09:00,10:30,14:30";
    process.env.WELCOMEFLOW_BOOKING_TIME_ZONE = "America/New_York";
    process.env.WELCOMEFLOW_BOOKING_MAX_DAYS_AHEAD = "60";
    process.env.WELCOMEFLOW_BOOKING_RATE_LIMIT_PER_MINUTE = "30";
    jest.doMock("@supabase/supabase-js", () => ({ createClient: jest.fn(() => currentClient) }));
  });

  afterEach(() => { jest.useRealTimers(); });
  afterAll(() => { process.env = originalEnv; jest.restoreAllMocks(); });

  test("saves a valid booking with an updated_at compare-and-swap and preserves unrelated content", async () => {
    const fixture = mockClient();
    currentClient = fixture.client;
    const handler = require("../api/book-screening");
    const res = responseRecorder();
    await handler(bookingRequest(), res);
    expect(res.statusCode).toBe(200);
    expect(fixture.state.reservations).toHaveLength(1);
    expect(fixture.state.reservations[0]).toMatchObject({ p_workspace_id: "phase1-booking-test", p_expected_updated_at: "2026-07-30T12:00:00.000Z", p_requisition_id: "req-1", p_facility_id: "facility-1" });
    expect(fixture.state.row.data.unrelatedRecruiterState).toEqual({ keep: true, revision: 7 });
    expect(fixture.state.row.data.hotLeads[0]).toMatchObject({ id: "lead-1", candidateName: "Synthetic Candidate", bookedScreeningDate: "2026-07-31", bookedScreeningTime: "10:30", bookingStatus: "Requested", bookingAccessConsumedAt: "2026-07-30T16:00:00.000Z" });
  });

  test("returns public scheduling context without candidate PII or internal identifiers", async () => {
    const fixture = mockClient();
    currentClient = fixture.client;
    const handler = require("../api/book-screening");
    const res = responseRecorder();
    await handler(bookingRequest({}, "phase1-booking-test", "GET"), res);
    const body = JSON.parse(res.body);
    expect(res.statusCode).toBe(200);
    expect(body.lead).toMatchObject({ position: "", facility: "Synthetic Facility", allowedSlots: ["09:00", "10:30", "14:30"], timeZone: "America/New_York" });
    expect(body.lead).not.toHaveProperty("id");
    expect(body.lead).not.toHaveProperty("candidateName");
    expect(body.lead).not.toHaveProperty("email");
    expect(body.lead).not.toHaveProperty("phone");
  });

  test("treats an identical repeated booking as idempotent", async () => {
    const fixture = mockClient({ data: workspaceData({ bookedScreeningDate: "2026-07-31", bookedScreeningTime: "10:30", bookingStatus: "Requested", bookingAccessConsumedAt: "2026-07-30T16:00:00.000Z" }) });
    currentClient = fixture.client;
    const handler = require("../api/book-screening");
    const res = responseRecorder();
    await handler(bookingRequest(), res);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ ok: true, duplicate: true });
    expect(fixture.state.reservations).toHaveLength(0);
  });

  test("rejects a different slot after the booking capability is consumed", async () => {
    const fixture = mockClient({ data: workspaceData({ bookedScreeningDate: "2026-07-31", bookedScreeningTime: "10:30", bookingStatus: "Requested", bookingAccessConsumedAt: "2026-07-30T16:00:00.000Z" }) });
    currentClient = fixture.client;
    const handler = require("../api/book-screening");
    const res = responseRecorder();
    await handler(bookingRequest({ requestedTime: "14:30" }), res);
    expect(res.statusCode).toBe(409);
    expect(res.body).toMatch(/already been used/i);
    expect(fixture.state.reservations).toHaveLength(0);
  });

  test("rejects a different slot when the atomic layer finds the token already booked", async () => {
    const fixture = mockClient({ reservationResult: "already_booked" });
    currentClient = fixture.client;
    const handler = require("../api/book-screening");
    const res = responseRecorder();
    await handler(bookingRequest({ requestedTime: "14:30" }), res);
    expect(res.statusCode).toBe(409);
    expect(res.body).toMatch(/already been used/i);
    expect(fixture.state.reservations).toHaveLength(1);
    expect(fixture.state.row.data.hotLeads[0].bookedScreeningTime).toBeUndefined();
  });

  test.each([
    [{ bookingAccessRevokedAt: "2026-07-29T12:00:00.000Z" }, "revoked"],
    [{ bookingAccessExpiresAt: "2026-07-29T12:00:00.000Z" }, "expired"],
    [{ bookingAccessScopeDigest: "b".repeat(64) }, "changed scope"],
    [{ bookingAccessTokenHash: "c".repeat(64) }, "unknown token"],
  ])("returns the same inactive-link response for a %s token", async (leadPatch) => {
    const fixture = mockClient({ data: workspaceData(leadPatch) });
    currentClient = fixture.client;
    const handler = require("../api/book-screening");
    const res = responseRecorder();
    await handler(bookingRequest({}, "phase1-booking-test", "GET"), res);
    expect(res.statusCode).toBe(404);
    expect(res.body).toBe('{"error":"This booking link is no longer active."}');
  });

  test.each([
    [{ bookingAccessScope: { action: "book-screening", workspaceId: "other", leadId: "lead-1", candidateId: "lead-1", requisitionId: "req-1", facilityId: "facility-1", recruiterId: "recruiter-1" } }, "workspace"],
    [{ selectedRequisitionId: "req-2" }, "requisition"],
    [{ facilityId: "facility-2" }, "facility"],
  ])("does not let token scope follow a later %s change", async (leadPatch) => {
    const data = workspaceData(leadPatch);
    const scope = data.hotLeads[0].bookingAccessScope;
    data.hotLeads[0].bookingAccessScopeDigest = crypto.createHash("sha256").update(`${BOOKING_TOKEN}\n${JSON.stringify(scope)}`).digest("hex");
    const fixture = mockClient({ data });
    currentClient = fixture.client;
    const handler = require("../api/book-screening");
    const res = responseRecorder();
    await handler(bookingRequest({}, "phase1-booking-test", "GET"), res);
    expect(res.statusCode).toBe(404);
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

  test.each([
    "Hired",
    "Rejected",
    "Ineligible",
    "Archived",
    "Do Not Contact",
    "Not Interested",
    "Unresponsive",
    "Converted to Candidate",
    "Ready for Intake",
    "Booked",
  ])("rejects the ineligible candidate state %s", async (status) => {
    const fixture = mockClient({ data: workspaceData({ status }) });
    currentClient = fixture.client;
    const handler = require("../api/book-screening");
    const res = responseRecorder();
    await handler(bookingRequest(), res);
    expect(res.statusCode).toBe(404);
    expect(fixture.state.reservations).toHaveLength(0);
  });

  test("prevents two leads from reserving the same recruiter slot", async () => {
    const fixture = mockClient({ reservationResult: "slot_taken" });
    currentClient = fixture.client;
    const handler = require("../api/book-screening");
    const res = responseRecorder();
    await handler(bookingRequest(), res);
    expect(res.statusCode).toBe(409);
    expect(res.body).toMatch(/just reserved/i);
    expect(fixture.state.reservations).toHaveLength(1);
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

  test("rejects predictable or unknown booking identifiers before workspace access", async () => {
    const fixture = mockClient();
    currentClient = fixture.client;
    const handler = require("../api/book-screening");
    const res = responseRecorder();
    const req = bookingRequest();
    req.query.token = "lead-1";
    await handler(req, res);
    expect(res.statusCode).toBe(404);
    expect(fixture.client.from).not.toHaveBeenCalled();
  });

  test.each([
    [{ requestedDate: "2026-07-29" }, /booking window/i],
    [{ requestedDate: "2026-10-30" }, /booking window/i],
    [{ requestedTime: "11:15" }, /available date and time/i],
    [{ meetingType: "In person" }, /meeting type/i],
    [{ preferredContactMethod: "Carrier pigeon" }, /contact method/i],
  ])("rejects invalid or server-disallowed slot context", async (patch, message) => {
    const fixture = mockClient();
    currentClient = fixture.client;
    const handler = require("../api/book-screening");
    const res = responseRecorder();
    await handler(bookingRequest(patch), res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatch(message);
    expect(fixture.state.reservations).toHaveLength(0);
  });

  test("rejects a booking when the linked requisition is not active", async () => {
    const fixture = mockClient({ data: workspaceData({}, { status: "Filled" }) });
    currentClient = fixture.client;
    const handler = require("../api/book-screening");
    const res = responseRecorder();
    await handler(bookingRequest(), res);
    expect(res.statusCode).toBe(404);
    expect(fixture.state.reservations).toHaveLength(0);
  });

  test("fails closed when shared rate limiting is unavailable or denies the request", async () => {
    const fixture = mockClient({ rateAllowed: false });
    currentClient = fixture.client;
    const handler = require("../api/book-screening");
    const res = responseRecorder();
    await handler(bookingRequest(), res);
    expect(res.statusCode).toBe(429);
    expect(fixture.state.reservations).toHaveLength(0);
  });

  test("never bypasses optimistic concurrency with a blind workspace upsert", () => {
    const source = fs.readFileSync(path.resolve(__dirname, "..", "api", "book-screening.js"), "utf8");
    expect(source).not.toMatch(/\.upsert\s*\(/);
    expect(source).toContain("welcomeflow_reserve_screening_slot");
    expect(source).toContain("p_expected_updated_at");
    expect(source).not.toMatch(/SUPABASE_ANON_KEY[\s\S]*serviceSupabaseClient/);
    expect(source).not.toMatch(/bookingAccessToken\s*===/);
    expect(source).toContain("timingSafeEqual");
  });

  test("the reservation migration makes recruiter slots unique and rechecks scope under a row lock", () => {
    const sql = fs.readFileSync(path.resolve(__dirname, "..", "supabase", "migrations", "20260807035520_reserve_screening_slots.sql"), "utf8").toLowerCase();
    expect(sql).toContain("primary key (workspace_id, recruiter_key, requested_date, requested_time)");
    expect(sql).toContain("welcomeflow_screening_reservation_lead_unique");
    expect(sql).toContain("welcomeflow_screening_reservation_token_unique");
    expect(sql).toContain("return 'already_booked'");
    expect(sql).toContain("bookingaccessconsumedat");
    expect(sql).toContain("for update");
    expect(sql).toContain("v_status not in");
    expect(sql).toContain("v_scope ->> 'requisitionid' <> p_requisition_id");
    expect(sql).toContain("v_scope ->> 'facilityid' <> p_facility_id");
    expect(sql).toContain("updated_at = p_expected_updated_at");
    expect(sql).toContain("security invoker");
  });
});
