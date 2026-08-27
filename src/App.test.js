import { render, screen } from "@testing-library/react";
import App, {
  candidateProfileCreated,
  migrateTrackerRecords,
  movementPatchForStage,
  movementStageIndex,
  pipelineProgressionForItem,
} from "./App";

function validCandidateReadyPackage() {
  return {
    schemaVersion: 1,
    purpose: "candidate-ready-facility-submission",
    snapshotHash: "migration-snapshot-hash",
    snapshot: {
      requisition: { requisitionId: "req-migration", facilityId: "facility-migration" },
      facility: { facilityId: "facility-migration" },
      intake: { candidateId: "candidate-migration" },
    },
    recipients: { facility: { to: ["manager@example.test"], cc: [] } },
    rendered: {
      facilityEmail: {
        templateKey: "hiringManager",
        subject: "Exact saved facility subject",
        body: "Exact saved facility body",
        releaseCondition: "candidateReadyConfirmed",
      },
    },
    templateReferences: {
      facilitySubmission: { templateKey: "hiringManager", id: "facility-external", version: 1 },
    },
    releaseConditions: { facilitySubmission: "candidateReadyConfirmed" },
    actionStates: { facilitySubmission: "Ready to Send" },
    unresolvedTokens: [],
    restrictedTokens: [],
  };
}

test("renders the WelcomeFlow shell", () => {
  render(<App />);

  expect(screen.getAllByText(/Recruiting Assistant/i).length).toBeGreaterThan(0);
  expect(screen.getByRole("button", { name: /Turn sounds off/i })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /Welcome back/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Sign In/i })).toBeInTheDocument();
});

test("does not promote a malformed legacy package into Candidate Ready state", () => {
  const [migrated] = migrateTrackerRecords([{
    id: "candidate-migration",
    candidate: "Synthetic Migration Candidate",
    requisitionId: "req-migration",
    facilityId: "facility-migration",
    reviewedSubmissionPackage: { rendered: {}, recipients: {}, snapshot: {} },
  }], {});

  expect(migrated).toMatchObject({
    status: "Submitted",
    nextAction: "Awaiting manager review",
  });
  expect(migrated.status).not.toBe("Ready for Facility Submission");
  expect(migrated.nextAction).not.toBe("Send facility submission");
  expect(migrated.pipelineStage).not.toBe("Submit");
  expect(migrated.communicationActionStates?.facilitySubmission).not.toBe("Ready to Send");
});

test("preserves Candidate Ready defaults for a fully valid saved package", () => {
  const [migrated] = migrateTrackerRecords([{
    id: "candidate-migration",
    candidate: "Synthetic Migration Candidate",
    requisitionId: "req-migration",
    facilityId: "facility-migration",
    reviewedSubmissionPackage: validCandidateReadyPackage(),
  }], {});

  expect(migrated).toMatchObject({
    status: "Ready for Facility Submission",
    pipelineStage: "Submit",
    stage: "Submit",
    nextAction: "Send facility submission",
    waitingOn: "Recruiter",
    communicationActionStates: { facilitySubmission: "Ready to Send" },
  });
});

test("does not treat a named Recruiter Review candidate as a created submission profile", () => {
  const candidate = {
    candidate: "Synthetic Pre-Submission Candidate",
    formSnapshot: { fullName: "Synthetic Pre-Submission Candidate" },
    createdAt: "2026-08-26T12:00:00.000Z",
    submissionDate: "2026-08-26",
    status: "Recruiter Review",
  };

  expect(candidateProfileCreated(candidate)).toBe(false);
  expect(movementStageIndex(candidate)).toBe(2);
  expect(pipelineProgressionForItem(candidate)).toBe("Recruiter Review");
});

test("keeps a named Screen Complete candidate before the Submit stage", () => {
  const candidate = {
    candidate: "Synthetic Screened Candidate",
    formSnapshot: { fullName: "Synthetic Screened Candidate" },
    createdAt: "2026-08-26T12:00:00.000Z",
    submissionDate: "2026-08-26",
    status: "Screen Complete",
  };

  expect(candidateProfileCreated(candidate)).toBe(false);
  expect(movementStageIndex(candidate)).toBe(1);
  expect(pipelineProgressionForItem(candidate)).toBe("Screen Complete");
});

test("records explicit Submit movement as Facility Submission evidence", () => {
  const patch = movementPatchForStage("Submit", {
    candidate: "Synthetic Submitted Candidate",
    status: "Recruiter Review",
  });

  expect(patch).toMatchObject({
    movementStage: "Submit",
    status: "Submitted",
    profileCreated: true,
  });
  expect(candidateProfileCreated(patch)).toBe(true);
  expect(movementStageIndex(patch)).toBe(3);
  expect(pipelineProgressionForItem(patch)).toBe("Facility Submission");
});

test.each([
  [{ status: "Submitted" }],
  [{ status: "Recruiter Review", candidateSubmittedToFacilityAt: "2026-08-26T12:00:00.000Z" }],
  [{ status: "Recruiter Review", facilitySubmissionSentAt: "2026-08-26T12:00:00.000Z" }],
])("preserves Facility Submission for canonical submission evidence", (evidence) => {
  expect(pipelineProgressionForItem({
    candidate: "Synthetic Submitted Candidate",
    ...evidence,
  })).toBe("Facility Submission");
});

test("preserves the correct close-out pipeline stage when submission was never reached", () => {
  const candidate = {
    candidate: "Synthetic Closed Candidate",
    formSnapshot: { fullName: "Synthetic Closed Candidate" },
    createdAt: "2026-08-26T12:00:00.000Z",
    submissionDate: "2026-08-26",
    status: "Recruiter Review",
    nextAction: "Clear missing requirements",
  };

  const closedFromPipelineStep = pipelineProgressionForItem(candidate);
  expect(closedFromPipelineStep).toBe("Recruiter Review");
  expect(closedFromPipelineStep).not.toBe("Facility Submission");
});
