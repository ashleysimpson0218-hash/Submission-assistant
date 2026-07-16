import {
  buildCompleteProcessArchivePatch,
  buildHireWorkflowPatch,
  buildInterviewSchedulePatch,
  buildOnboardingChecklistPatch,
  buildWithdrawalArchivePatch,
  hiredCountForReq,
  requisitionFillPatch,
} from "./workflowLogic";

const baseReq = { id: "req-1", reqNumber: "79000", numberOfOpenings: 2 };
const baseCandidate = {
  id: "cand-1",
  candidate: "Ashley Candidate",
  status: "Offer",
  reqNumber: "79000",
  requisitionId: "req-1",
  site: "GDCP",
  position: "LPN",
};

test("single-opening requisition is filled only after one permanent hire record", () => {
  const req = { ...baseReq, numberOfOpenings: 1 };
  const hired = { ...baseCandidate, ...buildHireWorkflowPatch(baseCandidate, { hireDate: "2026-06-09", now: "2026-06-09T12:00:00.000Z", id: "hire-1" }) };

  expect(hired.status).toBe("Onboarding");
  expect(hiredCountForReq(req, [hired])).toBe(1);
  expect(requisitionFillPatch(req, [hired])).toMatchObject({ filled: true, filledCount: 1, remainingOpenings: 0, status: "Filled" });
});

test("multi-opening requisition remains active until all openings have hires", () => {
  const firstHire = { ...baseCandidate, ...buildHireWorkflowPatch(baseCandidate, { hireDate: "2026-06-09", now: "2026-06-09T12:00:00.000Z", id: "hire-1" }) };
  const secondCandidate = { ...baseCandidate, id: "cand-2", candidate: "Second Candidate" };
  const secondHire = { ...secondCandidate, ...buildHireWorkflowPatch(secondCandidate, { hireDate: "2026-06-10", now: "2026-06-10T12:00:00.000Z", id: "hire-2" }) };

  expect(requisitionFillPatch(baseReq, [firstHire])).toMatchObject({ filled: false, filledCount: 1, remainingOpenings: 1, status: "Active" });
  expect(requisitionFillPatch(baseReq, [firstHire, secondHire])).toMatchObject({ filled: true, filledCount: 2, remainingOpenings: 0, status: "Filled" });
});

test("onboarding checklist does not archive the candidate", () => {
  const patch = buildOnboardingChecklistPatch({ ...baseCandidate, status: "Onboarding" }, {
    completedAllOnboardingSteps: true,
    updatedAtsForOnboarding: true,
    completedOnboardingBeforeCloseout: true,
  }, "2026-06-11T12:00:00.000Z");

  expect(patch.status).toBe("Onboarding");
  expect(patch.archived).toBe(false);
  expect(patch.nextAction).toBe("Complete Process and Archive");
});

test("explicit final archive preserves hired record state", () => {
  const hired = { ...baseCandidate, ...buildHireWorkflowPatch(baseCandidate, { hireDate: "2026-06-09", now: "2026-06-09T12:00:00.000Z", id: "hire-1" }) };
  const patch = buildCompleteProcessArchivePatch(hired, "2026-06-12T12:00:00.000Z");

  expect(patch.status).toBe("Archived");
  expect(patch.archiveOutcome).toBe("Hired");
  expect(patch.hireRecords).toHaveLength(1);
  expect(patch.finalArchiveDate).toBe("2026-06-12T12:00:00.000Z");
});

test("withdrawal archive stores reason and requires caller-provided notes when Other is used", () => {
  const patch = buildWithdrawalArchivePatch(baseCandidate, "Compensation", "Rate was not aligned.", "2026-06-12T12:00:00.000Z");

  expect(patch.status).toBe("Archived");
  expect(patch.withdrawalReason).toBe("Compensation");
  expect(patch.withdrawalNotes).toBe("Rate was not aligned.");
  expect(patch.archiveReason).toContain("Compensation");
});

test("interview schedule patch flags ATS update and avoids duplicate history for unchanged signature", () => {
  const draft = { interviewDate: "2026-06-15", interviewStartTime: "14:30", bookingSource: "Manual" };
  const first = buildInterviewSchedulePatch(baseCandidate, draft, { now: "2026-06-12T12:00:00.000Z" });
  const second = buildInterviewSchedulePatch({ ...baseCandidate, interviewScheduleSignature: first.interviewScheduleSignature }, draft, { now: "2026-06-12T12:30:00.000Z" });

  expect(first.status).toBe("Interview Scheduled");
  expect(first.atsUpdatePending).toBe(true);
  expect(first.shouldWriteHistory).toBe(true);
  expect(second.shouldWriteHistory).toBe(false);
});
