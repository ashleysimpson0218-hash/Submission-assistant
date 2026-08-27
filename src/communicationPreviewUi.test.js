import fs from "fs";
import path from "path";
import { fireEvent, render, screen } from "@testing-library/react";
import { CommunicationPreviewModal } from "./App";

function previewFixture(overrides = {}) {
  return {
    canConfirm: true,
    blockers: [],
    warnings: [{ code: "TEXT_OPTIONAL", message: "Text is configured as optional." }],
    snapshot: {
      requisition: { reqNumber: "REQ-TEST", position: "Registered Nurse", facility: "Test Facility", employmentType: "Full-time" },
      intake: { candidateName: "Synthetic Candidate", candidateType: "External", candidateTypeConfirmed: true },
      facility: { facilityName: "Test Facility" },
    },
    recipients: {
      facility: { to: ["manager@example.test"], cc: ["admin@example.test"] },
      candidate: { to: ["candidate@example.test"] },
    },
    rendered: {
      facilityEmail: { templateKey: "hiringManager", variantKey: "root", subject: "Facility subject", body: "Exact facility body" },
      candidateEmail: { templateKey: "candidateConfirmation", variantKey: "root", subject: "Candidate subject", body: "Exact candidate body" },
      candidateText: { templateKey: "submission-text", body: "Exact candidate text" },
      atsUpdate: { templateKey: "atsUpdate", variantKey: "root", subject: "ATS subject", body: "Exact ATS body" },
    },
    unresolvedTokens: [],
    restrictedTokens: [],
    snapshotHash: "fnv1a-testhash",
    ...overrides,
  };
}

describe("side-effect-free submission package preview", () => {
  test("renders every exact summary, recipient, subject, body, warning, and snapshot hash", () => {
    render(<CommunicationPreviewModal preview={previewFixture()} onClose={jest.fn()} onRefresh={jest.fn()} />);

    expect(screen.getByRole("dialog", { name: "Submission preview" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Preview Submission.*Nothing Saved Yet/i })).toBeInTheDocument();
    ["Synthetic Candidate", "External", "Registered Nurse", "Test Facility", "REQ-TEST"].forEach((value) => expect(screen.getAllByText(value).length).toBeGreaterThan(0));
    ["manager@example.test", "admin@example.test", "candidate@example.test", "Facility subject", "Exact facility body", "Candidate subject", "Exact candidate body", "Exact candidate text", "ATS subject", "Exact ATS body"].forEach((value) => expect(screen.getByText(value)).toBeInTheDocument());
    expect(screen.getAllByText("fnv1a-testhash", { exact: false }).length).toBeGreaterThan(0);
    expect(screen.getByText("Warnings")).toBeInTheDocument();
    expect(screen.getByText("Text is configured as optional.")).toBeInTheDocument();
    expect(screen.getAllByText("Preview Complete").length).toBeGreaterThan(0);
    expect(screen.getByText(/Final Candidate Ready confirmation is not enabled in this phase/i)).toBeInTheDocument();
  });

  test("shows blockers separately and preserves unsupported and restricted tokens", () => {
    const preview = previewFixture({
      canConfirm: false,
      blockers: [{ code: "UNRESOLVED_TEMPLATE_TOKENS", message: "A required template token is unresolved.", source: "template", field: "tokens" }],
      unresolvedTokens: ["{{payType}}"],
      restrictedTokens: ["{{employeeId}}"],
      rendered: {
        ...previewFixture().rendered,
        candidateEmail: { templateKey: "candidateConfirmation", variantKey: "root", subject: "Candidate subject", body: "Pay type: [UNRESOLVED TOKEN: {{payType}}]" },
      },
    });
    render(<CommunicationPreviewModal preview={preview} onClose={jest.fn()} onRefresh={jest.fn()} />);

    expect(screen.getAllByText("Action Required").length).toBeGreaterThan(0);
    expect(screen.getByText("Warnings")).toBeInTheDocument();
    expect(screen.getAllByText(/payType/).length).toBeGreaterThan(0);
    expect(screen.getByText(/employeeId/)).toBeInTheDocument();
  });

  test("shows the text configuration warning when no submission text is selected", () => {
    const preview = previewFixture({ rendered: { ...previewFixture().rendered, candidateText: null } });
    render(<CommunicationPreviewModal preview={preview} onClose={jest.fn()} onRefresh={jest.fn()} />);
    expect(screen.getByText(/No explicitly selected submission text template/i)).toBeInTheDocument();
  });

  test("marks a stale snapshot Out of Date and refreshes only on request", () => {
    const onRefresh = jest.fn();
    render(<CommunicationPreviewModal preview={previewFixture()} outOfDate onClose={jest.fn()} onRefresh={onRefresh} />);
    expect(screen.getAllByText("Out of Date").length).toBeGreaterThan(0);
    expect(screen.getByText(/Relevant intake, requisition, facility, recipient, or template information changed/i)).toBeInTheDocument();
    expect(onRefresh).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Refresh Preview" }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  test("returns to intake or closes without any operational confirmation action", () => {
    const onClose = jest.fn();
    render(<CommunicationPreviewModal preview={previewFixture()} onClose={onClose} onRefresh={jest.fn()} />);
    expect(screen.queryByRole("button", { name: /Confirm.*Candidate Ready/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mark Candidate Ready/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Ready to Confirm/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Return to Intake" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("rendering and reviewing cannot use browser, network, clipboard, or storage side effects", () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockImplementation(() => Promise.reject(new Error("unexpected network call")));
    const openSpy = jest.spyOn(window, "open").mockImplementation(() => null);
    const storageSpy = jest.spyOn(Storage.prototype, "setItem");
    const onClose = jest.fn();
    const onRefresh = jest.fn();
    render(<CommunicationPreviewModal preview={previewFixture()} onClose={onClose} onRefresh={onRefresh} />);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();
    expect(storageSpy).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(onRefresh).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    openSpy.mockRestore();
    storageSpy.mockRestore();
  });

  test("Phase 2D confirmation callback is flag-gated and never bridges to output generation or communication actions", () => {
    const source = fs.readFileSync(path.join(__dirname, "App.js"), "utf8");
    const modalStart = source.indexOf("export function CommunicationPreviewModal");
    const modalEnd = source.indexOf("function AgingFollowUpReview", modalStart);
    const modalSource = source.slice(modalStart, modalEnd);
    const modalInvocationStart = source.indexOf("<CommunicationPreviewModal");
    const modalInvocation = source.slice(modalInvocationStart, source.indexOf("/> : null", modalInvocationStart) + 2);

    expect(modalSource).not.toMatch(/generateOutput|buildOutput|mailto|clipboard|setSettings|supabase/i);
    expect(modalSource).toMatch(/confirmationEnabled && preview\.canConfirm && !outOfDate/);
    expect(modalInvocation).toMatch(/confirmationEnabled=\{reviewedCandidateReadyConfirmationEnabled\}/);
    expect(modalInvocation).not.toMatch(/generateOutput|buildOutput/);
    expect(source).not.toMatch(/confirmCommunicationPreview|generatedOutputFromPreview/);
    expect(source).toMatch(/communicationPreviewFlowEnabled \? <Button primary onClick=\{openCommunicationPreview\}/);
    expect(source).toMatch(/: <Button primary onClick=\{generateOutput\}/);
  });

  test("changing candidate type clears explicit confirmation only in the flagged test flow", () => {
    const source = fs.readFileSync(path.join(__dirname, "App.js"), "utf8");
    expect(source).toMatch(/if \(communicationPreviewFlowEnabled\) \{\s*next\.candidateTypeConfirmed = false/);
    expect(source).toMatch(/communicationRuntimeEnabled && isFeatureFlagEnabled\(settings, "reviewedCandidateReadyConfirmation"\)/);
    expect(source).toMatch(/isFeatureFlagEnabled\(settings, "communicationPreviewFlow"\) \|\| reviewedCandidateReadyConfirmationEnabled/);
    expect(source).toMatch(/candidateTypeConfirmed: form\.candidateTypeConfirmed === true/);
  });

  test("only valid reviewed Candidate Ready packages receive pre-submission migration defaults", () => {
    const source = fs.readFileSync(path.join(__dirname, "App.js"), "utf8");
    expect(source).toMatch(/const hasValidReviewedSubmissionPackage = Boolean\(item\.reviewedSubmissionPackage\)/);
    expect(source).toMatch(/validateCandidateReadyFacilitySubmissionPackage\(item\.reviewedSubmissionPackage/);
    expect(source).toMatch(/submissionDate: hasValidReviewedSubmissionPackage \? \(item\.submissionDate \|\| ""\)/);
    expect(source).toMatch(/hasValidReviewedSubmissionPackage && Array\.isArray\(item\.audit\) \? item\.audit/);
    expect(source).toMatch(/hasValidReviewedSubmissionPackage \? "Ready for Facility Submission" : "Submitted"/);
    expect(source).toMatch(/hasValidReviewedSubmissionPackage \? "Send facility submission"/);
    expect(source).toMatch(/hasValidReviewedSubmissionPackage \? "Recruiter"/);
  });

  test("Phase 2E communication actions are test-flagged and replace legacy actions only for reviewed packages", () => {
    const source = fs.readFileSync(path.join(__dirname, "App.js"), "utf8");
    expect(source).toMatch(/testRuntime\.ok && isFeatureFlagEnabled\(settings, "reviewedSubmissionCommunicationActions"\)/);
    expect(source).toMatch(/reviewedSubmissionCommunicationActionsEnabled && selectedSubmission\.reviewedSubmissionPackage \? <SubmissionCommunicationsPanel/);
    expect(source).toMatch(/: <Accordion title="Communication Command Center"/);
    expect(source).toMatch(/profileDrawerTab === "communication"[\s\S]*reviewedSubmissionCommunicationActionsEnabled && selectedSubmission\.reviewedSubmissionPackage \? <SubmissionCommunicationsPanel/);
    expect(source).toMatch(/Legacy regenerated ATS actions are disabled for this reviewed package/);
    expect(source).toMatch(/runReviewedCommunicationAction\(record\.id, applyFacilityEmailOpened/);
    expect(source).toMatch(/latest\.reviewedSubmissionPackage\?\.rendered\?\.candidateText\?\.body/);
    expect(source).toMatch(/latest\.reviewedSubmissionPackage\?\.rendered\?\.atsUpdate\?\.body/);
    const actionStart = source.indexOf("async function runReviewedCommunicationAction");
    const actionEnd = source.indexOf("function generateOutput", actionStart);
    const actionSource = source.slice(actionStart, actionEnd);
    expect(actionSource).not.toMatch(/buildOutput|generateOutput|applyTokens|\/api\//);
  });

  test("Phase 2.1C Action Center controls are independently authorized and do not send or persist", () => {
    const appSource = fs.readFileSync(path.join(__dirname, "App.js"), "utf8");
    const workspaceSource = fs.readFileSync(path.join(__dirname, "RecruiterWorkspacePage.js"), "utf8");
    const actionSource = fs.readFileSync(path.join(__dirname, "actionCenterCommunicationActions.js"), "utf8");

    expect(appSource).toMatch(/actionCenterCommunicationAuditPersistenceEnabled && isFeatureFlagEnabled\(settings, "actionCenterControlledCommunicationActions"\)/);
    expect(appSource).toMatch(/communicationRuntimeEnabled && Boolean\(supabase\) && isFeatureFlagEnabled\(settings, "actionCenterCommunicationAuditPersistence"\)/);
    expect(appSource).toMatch(/actionCenterControlledCommunicationActionsEnabled && isFeatureFlagEnabled\(settings, "actionCenterPrefilledEmailDrafts"\)/);
    expect(appSource).toMatch(/controlledCommunicationActionsAuthorized=\{actionCenterControlledCommunicationActionsEnabled\}/);
    expect(appSource).toMatch(/prefilledEmailDraftAuthorized=\{actionCenterPrefilledEmailDraftsEnabled\}/);
    expect(workspaceSource).toMatch(/revalidateActionCenterCommunicationAction/);
    expect(workspaceSource).toMatch(/Recruiter confirmation required/);
    expect(actionSource).not.toMatch(/fetch\(|supabase|localStorage|sessionStorage|indexedDB|Paycom/i);
    expect(workspaceSource).not.toMatch(/Mark Sent|Send Email|Send Now/);
  });
});
