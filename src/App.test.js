import { render, screen } from "@testing-library/react";
import App, { migrateTrackerRecords } from "./App";

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
