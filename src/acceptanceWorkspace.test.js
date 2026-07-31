import { canonicalJson, verifyAcceptanceWorkspace, workspaceCounts, workspaceFingerprint } from "./acceptanceWorkspace";

const workspace = {
  tracker: [{ id: "candidate-1" }, { id: "candidate-2" }],
  history: [{ id: "history-1" }],
  reportHistory: [{ id: "report-1" }],
  hotLeads: [{ id: "lead-1" }],
  intakeDrafts: [{ id: "draft-1" }],
  settings: {
    sites: [{ id: "facility-1" }],
    requisitions: { one: { id: "req-1" }, two: { id: "req-2" } },
    contacts: [{ id: "contact-1", contactRole: "Regional Director", assignedFacilityIds: ["facility-1"] }],
  },
};

test("workspace counts reflect the exact loaded cloud collections", () => {
  expect(workspaceCounts(workspace)).toEqual({
    candidates: 2,
    facilities: 1,
    requisitions: 2,
    history: 1,
    reportHistory: 1,
    hotLeads: 1,
    intakeDrafts: 1,
    regionalContacts: 1,
  });
});

test("canonical workspace fingerprint is deterministic across object key order", async () => {
  const reverse = { settings: workspace.settings, reportHistory: workspace.reportHistory, history: workspace.history, tracker: workspace.tracker, intakeDrafts: workspace.intakeDrafts, hotLeads: workspace.hotLeads };
  expect(canonicalJson(workspace)).toBe(canonicalJson(reverse));
  const digest = new Uint8Array(32).fill(10).buffer;
  const cryptoApi = { subtle: { digest: jest.fn().mockResolvedValue(digest) } };
  expect(await workspaceFingerprint(workspace, cryptoApi)).toBe("0a".repeat(32));
  expect(cryptoApi.subtle.digest).toHaveBeenCalledWith("SHA-256", expect.any(Uint8Array));
});

test("workspace verification passes only exact counts and fingerprint", () => {
  const exact = verifyAcceptanceWorkspace({
    workspaceId: "phase1-acceptance-synthetic",
    expectedWorkspaceId: "phase1-acceptance-synthetic",
    expectedCounts: { candidates: 2, facilities: 1, requisitions: 2, history: 1, reportHistory: 1 },
    expectedFingerprint: "fixture-hash",
    actualCounts: workspaceCounts(workspace),
    actualFingerprint: "fixture-hash",
  });
  expect(exact).toMatchObject({ ok: true, mismatches: [] });

  const mismatch = verifyAcceptanceWorkspace({
    workspaceId: "phase1-acceptance-synthetic",
    expectedCounts: { candidates: 100 },
    expectedFingerprint: "fixture-hash",
    actualCounts: workspaceCounts(workspace),
    actualFingerprint: "different",
  });
  expect(mismatch.ok).toBe(false);
  expect(mismatch.message).toMatch(/expected 100/);
  expect(mismatch.message).toMatch(/fingerprint/);
});

test("workspace verification rejects a different non-default workspace", () => {
  const result = verifyAcceptanceWorkspace({
    workspaceId: "another-synthetic-workspace",
    expectedWorkspaceId: "phase1-acceptance-synthetic",
    expectedCounts: workspaceCounts(workspace),
    actualCounts: workspaceCounts(workspace),
    expectedFingerprint: "fixture-hash",
    actualFingerprint: "fixture-hash",
  });
  expect(result.ok).toBe(false);
  expect(result.message).toMatch(/workspace ID/);
});
