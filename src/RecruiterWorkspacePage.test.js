import { fireEvent, render, screen } from "@testing-library/react";
import { RecruiterWorkspacePage } from "./RecruiterWorkspacePage";

const theme = {
  panel: "#fff", panelAlt: "#f7f4ff", borderSoft: "#ddd", shadow: "none", text: "#17112f", muted: "#6b6680",
  primary2: "#6d28d9", red: "#dc2626", redBg: "#fee2e2", amber: "#d97706", amberBg: "#fef3c7", green: "#15803d", greenBg: "#dcfce7",
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-07-22T12:00:00.000Z"));
});

afterEach(() => {
  jest.useRealTimers();
});

test("renders the recruiter command center and filters its shared queue", () => {
  const candidate = { id: "candidate-1", candidate: "Synthetic Candidate", status: "Submitted", nextAction: "Await decision maker review", submissionDate: "2026-07-21", candidateNotes: "Synthetic" };
  const source = JSON.parse(JSON.stringify(candidate));
  render(<RecruiterWorkspacePage
    theme={theme}
    tracker={[candidate]}
    requisitions={[]}
    recruiterName="Synthetic Recruiter"
    onOpenCandidate={jest.fn()}
    onOpenRequisition={jest.fn()}
    onOpenWeeklyCleanup={jest.fn()}
    onOpenReports={jest.fn()}
  />);

  expect(screen.getByRole("heading", { name: /Recruiter Workspace/i })).toBeInTheDocument();
  expect(screen.getByText(/Your command center for today’s recruiting priorities/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: /Waiting on Others/i }));
  expect(screen.getByText("Synthetic Candidate")).toBeInTheDocument();
  expect(screen.getAllByText("Hiring Manager").length).toBeGreaterThan(0);
  expect(screen.getByText(/The next recorded step is controlled by Hiring Manager/i)).toBeInTheDocument();
  expect(candidate).toEqual(source);
});

test("keeps Hiring Manager ownership when an aged record uses the higher-priority risk explanation", () => {
  jest.setSystemTime(new Date("2026-07-29T12:00:00.000Z"));
  const candidate = { id: "candidate-aged", candidate: "Synthetic Aged Candidate", status: "Submitted", nextAction: "Await decision maker review", submissionDate: "2026-07-21", candidateNotes: "Synthetic" };
  const source = JSON.parse(JSON.stringify(candidate));
  render(<RecruiterWorkspacePage
    theme={theme}
    tracker={[candidate]}
    requisitions={[]}
    recruiterName="Synthetic Recruiter"
    onOpenCandidate={jest.fn()}
    onOpenRequisition={jest.fn()}
    onOpenWeeklyCleanup={jest.fn()}
    onOpenReports={jest.fn()}
  />);

  fireEvent.click(screen.getByRole("tab", { name: /Waiting on Others/i }));
  expect(screen.getByText("Synthetic Aged Candidate")).toBeInTheDocument();
  expect(screen.getAllByText("Hiring Manager").length).toBeGreaterThan(0);
  expect(screen.getByText(/days without recorded activity|facility review has not produced a recorded next step/i)).toBeInTheDocument();
  expect(screen.queryByText(/The next recorded step is controlled by Hiring Manager/i)).not.toBeInTheDocument();
  expect(candidate).toEqual(source);
});

test("shows useful empty-state language", () => {
  render(<RecruiterWorkspacePage theme={theme} tracker={[]} requisitions={[]} onOpenCandidate={jest.fn()} onOpenRequisition={jest.fn()} onOpenWeeklyCleanup={jest.fn()} onOpenReports={jest.fn()} />);
  expect(screen.getByText("You have no urgent recruiter-owned tasks.")).toBeInTheDocument();
  expect(screen.getAllByText("Not enough data")).toHaveLength(5);
});

test("opens explicit task actions without invoking communication behavior", () => {
  const onTaskAction = jest.fn(() => true);
  const onScheduleCalendar = jest.fn();
  render(<RecruiterWorkspacePage
    theme={theme}
    tracker={[{ id: "candidate-risk", candidate: "Synthetic Risk Candidate", status: "Submitted", nextAction: "Await decision maker review", submissionDate: "2026-07-01", lastActionAt: "2026-07-01", candidateNotes: "Needs update" }]}
    requisitions={[]}
    onOpenCandidate={jest.fn()}
    onOpenRequisition={jest.fn()}
    onOpenWeeklyCleanup={jest.fn()}
    onOpenReports={jest.fn()}
    onTaskAction={onTaskAction}
    onScheduleCalendar={onScheduleCalendar}
  />);
  fireEvent.click(screen.getByRole("tab", { name: /Candidate Rescue/i }));
  fireEvent.click(screen.getByRole("button", { name: "More actions for Synthetic Risk Candidate" }));
  expect(screen.getByRole("region", { name: "Task actions for Synthetic Risk Candidate" })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Update or resolution note"), { target: { value: "Candidate confirmed interest." } });
  fireEvent.click(screen.getByRole("button", { name: "Schedule Follow-Up" }));
  expect(onScheduleCalendar).toHaveBeenCalledWith(expect.objectContaining({ sourceId: "candidate-risk" }));
  fireEvent.click(screen.getByRole("button", { name: "Mark Not At Risk" }));
  expect(onTaskAction).toHaveBeenCalledWith(expect.objectContaining({ sourceId: "candidate-risk" }), "not-at-risk", expect.objectContaining({ note: "Candidate confirmed interest." }));
  expect(screen.queryByText(/Send Email|Send Text|Copy/i)).not.toBeInTheDocument();
});

test("Focus Mode minimizes nonurgent workspace content", () => {
  const onWorkspaceEvent = jest.fn();
  render(<RecruiterWorkspacePage
    theme={theme}
    tracker={[]}
    requisitions={[{ id: "req-focus", status: "Active", positionTitle: "Synthetic LPN", siteName: "Synthetic Facility", openings: 3, openDate: "2026-07-01", shiftPreference: "Night" }]}
    onOpenCandidate={jest.fn()}
    onOpenRequisition={jest.fn()}
    onOpenWeeklyCleanup={jest.fn()}
    onOpenReports={jest.fn()}
    onWorkspaceEvent={onWorkspaceEvent}
  />);
  fireEvent.click(screen.getByRole("button", { name: "Start Focus Session" }));
  expect(screen.getByText("Focus Mode keeps the priority requisition and essential work visible.")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Recruiting Focus Session" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Today’s Plan" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Finish Focus Session" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Finish Focus Session" }));
  expect(onWorkspaceEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "Recruiting Focus Session Completed" }));
});

test("shows report-readiness issues and an end-of-day summary", () => {
  const onWorkspaceEvent = jest.fn();
  render(<RecruiterWorkspacePage
    theme={theme}
    tracker={[{ id: "candidate-report", candidate: "Synthetic Candidate", status: "Offer Accepted", site: "Synthetic Facility", requisitionId: "req-report" }]}
    requisitions={[{ id: "req-report", reqNumber: "100", positionTitle: "Synthetic LPN", siteName: "Synthetic Facility", facilityId: "facility-report" }]}
    sites={[{ id: "facility-report", siteName: "Synthetic Facility", status: "Active" }]}
    onOpenCandidate={jest.fn()}
    onOpenRequisition={jest.fn()}
    onOpenWeeklyCleanup={jest.fn()}
    onOpenReports={jest.fn()}
    onWorkspaceEvent={onWorkspaceEvent}
  />);
  fireEvent.click(screen.getByRole("button", { name: "Review Missing Items" }));
  expect(screen.getByRole("region", { name: "Weekly report readiness issues" })).toBeInTheDocument();
  expect(screen.getAllByText("Candidate notes are missing").length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: "Wrap Up My Day" }));
  expect(screen.getByRole("dialog", { name: "Wrap Up My Day" })).toBeInTheDocument();
  expect(screen.getByText("Urgent actions remaining")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Finish Day" }));
  expect(onWorkspaceEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "Recruiter Day Finished" }));
});
