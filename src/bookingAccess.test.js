import { webcrypto } from "crypto";
import { canonicalBookingScope, issueBookingAccess, sha256Hex } from "./bookingAccess";

const scope = {
  workspaceId: "phase1-booking-test",
  leadId: "lead-1",
  candidateId: "lead-1",
  requisitionId: "req-1",
  facilityId: "facility-1",
};

describe("booking access issuance", () => {
  test("persists only token hashes and immutable scope metadata", async () => {
    const result = await issueBookingAccess(scope, {
      cryptoImpl: webcrypto,
      now: new Date("2026-07-30T12:00:00.000Z"),
    });
    expect(result.rawToken).toMatch(/^[a-f0-9]{64}$/);
    expect(result.record).toMatchObject({
      bookingAccessTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      bookingAccessScope: { ...scope, action: "book-screening" },
      bookingAccessScopeDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
      bookingAccessIssuedAt: "2026-07-30T12:00:00.000Z",
      bookingAccessExpiresAt: "2026-08-29T12:00:00.000Z",
      bookingAccessRevokedAt: "",
    });
    expect(result.record).not.toHaveProperty("bookingAccessToken");
    expect(result.record.bookingAccessTokenHash).toBe(await sha256Hex(result.rawToken, webcrypto));
    expect(result.record.bookingAccessScopeDigest).toBe(
      await sha256Hex(`${result.rawToken}\n${canonicalBookingScope(scope)}`, webcrypto),
    );
  });

  test("fails closed without complete immutable scope", async () => {
    const result = await issueBookingAccess({ ...scope, facilityId: "" }, { cryptoImpl: webcrypto });
    expect(result).toEqual({ rawToken: "", record: {} });
  });

  test("fails closed when secure browser cryptography is unavailable", async () => {
    const result = await issueBookingAccess(scope, { cryptoImpl: {} });
    expect(result).toEqual({ rawToken: "", record: {} });
  });
});
