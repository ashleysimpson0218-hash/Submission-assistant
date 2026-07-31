import { fireEvent, render, screen } from "@testing-library/react";
import { AcceptanceWorkspaceGate } from "./AcceptanceWorkspaceGate";

const diagnostics = {
  status: "loaded",
  workspaceId: "phase1-acceptance-synthetic",
  environment: "test",
  source: "Cloud",
  updatedAt: "2026-07-24T17:13:29.033Z",
  fingerprint: "77e09a1cec69ddc099638129451f857b7363fa0c419a15e27cb4bf22be95f5f4",
  autosaveEnabled: false,
  counts: { candidates: 100, facilities: 32, requisitions: 114, history: 200, reportHistory: 53, hotLeads: 122, intakeDrafts: 7, regionalContacts: 3 },
};

test("acceptance gate shows workspace identity, counts, fingerprint, source, and disabled autosave", () => {
  render(<AcceptanceWorkspaceGate diagnostics={diagnostics} expectedCounts={{ candidates: 100, facilities: 32, requisitions: 114, history: 200, reportHistory: 53 }} onVerify={() => {}} />);
  expect(screen.getByTestId("acceptance-workspace-id")).toHaveTextContent("phase1-acceptance-synthetic");
  expect(screen.getByText("Cloud")).toBeInTheDocument();
  expect(screen.getAllByText("Disabled")).toHaveLength(2);
  expect(screen.getByText("Browser Persistence")).toBeInTheDocument();
  expect(screen.getByText("Locked")).toBeInTheDocument();
  expect(screen.getByText("77e09a1cec69...")).toBeInTheDocument();
  [100, 32, 114, 200, 53, 122, 7, 3].forEach((value) => expect(screen.getByText(String(value))).toBeInTheDocument());
});

test("acceptance gate does not enable verification before cloud loading succeeds", () => {
  const onVerify = jest.fn();
  const { rerender } = render(<AcceptanceWorkspaceGate diagnostics={{ ...diagnostics, status: "loading" }} expectedCounts={{}} onVerify={onVerify} />);
  expect(screen.getByRole("button", { name: "Verify Workspace" })).toBeDisabled();
  rerender(<AcceptanceWorkspaceGate diagnostics={diagnostics} expectedCounts={{}} onVerify={onVerify} />);
  fireEvent.click(screen.getByRole("button", { name: "Verify Workspace" }));
  expect(onVerify).toHaveBeenCalledTimes(1);
});

test("loaded diagnostics remain an interaction lock until Verify Workspace is used", () => {
  render(<AcceptanceWorkspaceGate diagnostics={diagnostics} expectedCounts={{ candidates: 100, facilities: 32, requisitions: 114, history: 200, reportHistory: 53 }} onVerify={() => {}} />);
  expect(screen.getByRole("button", { name: "Verify Workspace" })).toBeEnabled();
  expect(screen.queryByText("Recruiter Workspace")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Start Weekly Review/i })).not.toBeInTheDocument();
});

test("verification remains disabled when the locked workspace failed to load", () => {
  render(<AcceptanceWorkspaceGate diagnostics={{ ...diagnostics, status: "failed" }} expectedCounts={{}} loadError="Workspace verification failed." onVerify={() => {}} />);
  expect(screen.getByRole("button", { name: "Verify Workspace" })).toBeDisabled();
  expect(screen.getByRole("alert")).toHaveTextContent("Workspace verification failed.");
});
