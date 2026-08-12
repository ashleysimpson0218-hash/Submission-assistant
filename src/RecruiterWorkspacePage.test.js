import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { RecruiterWorkspacePage } from "./RecruiterWorkspacePage";
import { FacilityPositionSetupPage, actionCenterNavigationState, activeActionCenterCandidateTargetForSelection, clearedActionCenterTargets, resolveActionCenterCandidateTarget, resolveActionCenterSetupTarget } from "./App";

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
  expect(screen.getAllByText("Synthetic Candidate").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Hiring Manager").length).toBeGreaterThan(0);
  expect(screen.getByText(/The next recorded step is controlled by Hiring Manager/i)).toBeInTheDocument();
  expect(candidate).toEqual(source);
});

test("keeps the existing My Work Queue candidate opener independent from strict Action Center navigation", () => {
  const onOpenCandidate = jest.fn();
  const onOpenActionCenterCandidate = jest.fn();
  render(<RecruiterWorkspacePage
    theme={theme}
    tracker={[{ id: "candidate-no-exact-req", candidate: "Synthetic Unresolved Candidate", status: "Submitted", nextAction: "Follow up with candidate", candidateNotes: "Synthetic" }]}
    requisitions={[]}
    onOpenCandidate={onOpenCandidate}
    onOpenActionCenterCandidate={onOpenActionCenterCandidate}
    onOpenRequisition={jest.fn()}
    onOpenWeeklyCleanup={jest.fn()}
    onOpenReports={jest.fn()}
  />);

  fireEvent.click(screen.getByRole("button", { name: "Open Candidate" }));
  expect(onOpenCandidate).toHaveBeenCalledWith("candidate-no-exact-req", "", expect.objectContaining({ sourceId: "candidate-no-exact-req" }));
  expect(onOpenActionCenterCandidate).not.toHaveBeenCalled();
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
  expect(screen.getAllByText("Synthetic Aged Candidate").length).toBeGreaterThan(0);
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

test("renders the read-only Action Center with the approved category filters and explanations", () => {
  const candidate = {
    id: "candidate-follow-up",
    candidate: "Synthetic Follow-Up Candidate",
    status: "Submitted",
    nextAction: "Follow up with candidate",
    nextActionDueDate: "2026-07-21",
    lastActionAt: "2026-07-19T12:00:00.000Z",
    candidateNotes: "Synthetic note",
    currentOwner: "Recruiter",
    ownerType: "Recruiter",
    requisitionId: "req-follow-up",
    position: "Registered Nurse",
    site: "Synthetic Facility",
    facilityId: "facility-follow-up",
  };
  const source = JSON.parse(JSON.stringify(candidate));
  render(<RecruiterWorkspacePage
    theme={theme}
    tracker={[candidate]}
    requisitions={[{ id: "req-follow-up", reqNumber: "SYN-2001", positionTitle: "Registered Nurse", siteName: "Synthetic Facility", facilityId: "facility-follow-up", status: "Active" }]}
    sites={[{ id: "facility-follow-up", siteName: "Synthetic Facility", regionName: "Synthetic Region", status: "Active", hiringManagerEmail: "manager@example.test" }]}
    onOpenCandidate={jest.fn()}
    onOpenRequisition={jest.fn()}
    onOpenWeeklyCleanup={jest.fn()}
    onOpenReports={jest.fn()}
  />);

  expect(screen.getByRole("heading", { name: "Recruiter Action Center" })).toBeInTheDocument();
  const filters = screen.getByRole("tablist", { name: "Action Center filters" });
  expect(within(filters).getByRole("tab", { name: /All/i })).toBeInTheDocument();
  expect(within(filters).getByRole("tab", { name: /Follow-up Due/i })).toBeInTheDocument();
  expect(within(filters).getByRole("tab", { name: /Manager Feedback/i })).toBeInTheDocument();
  expect(within(filters).getByRole("tab", { name: /Candidate Ready/i })).toBeInTheDocument();
  expect(within(filters).getByRole("tab", { name: /Data Blockers/i })).toBeInTheDocument();
  fireEvent.click(within(filters).getByRole("tab", { name: /Follow-up Due/i }));
  expect(screen.getByText(/Recruiter follow-up due for Synthetic Follow-Up Candidate/i)).toBeInTheDocument();
  expect(screen.getByText(/Why this needs attention/i)).toBeInTheDocument();
  expect(candidate).toEqual(source);
});

test("opens a read-only detail preview and navigates with the exact candidate and requisition identifiers", () => {
  const onOpenCandidate = jest.fn();
  const onTaskAction = jest.fn();
  const onWorkspaceEvent = jest.fn();
  render(<RecruiterWorkspacePage
    theme={theme}
    tracker={[{
      id: "candidate-exact",
      candidate: "Synthetic Exact Candidate",
      status: "Submitted",
      nextAction: "Follow up with candidate",
      nextActionDueDate: "2026-07-21",
      lastActionAt: "2026-07-18T12:00:00.000Z",
      candidateNotes: "Synthetic",
      currentOwner: "Recruiter",
      ownerType: "Recruiter",
      requisitionId: "req-exact",
      position: "LPN",
      site: "Synthetic Facility",
      facilityId: "facility-exact",
    }]}
    requisitions={[{ id: "req-exact", reqNumber: "SYN-2002", positionTitle: "LPN", siteName: "Synthetic Facility", facilityId: "facility-exact", status: "Active" }]}
    sites={[{ id: "facility-exact", siteName: "Synthetic Facility", status: "Active", hiringManagerEmail: "manager@example.test" }]}
    onOpenCandidate={onOpenCandidate}
    onOpenRequisition={jest.fn()}
    onOpenWeeklyCleanup={jest.fn()}
    onOpenReports={jest.fn()}
    onTaskAction={onTaskAction}
    onWorkspaceEvent={onWorkspaceEvent}
  />);

  fireEvent.click(screen.getByRole("button", { name: /Review details for Recruiter follow-up due for Synthetic Exact Candidate/i }));
  const details = screen.getByRole("region", { name: /Action details for Recruiter follow-up due for Synthetic Exact Candidate/i });
  expect(within(details).getByText("candidate-exact")).toBeInTheDocument();
  expect(within(details).getByText("req-exact")).toBeInTheDocument();
  expect(within(details).getByText(/Read-only preview/i)).toBeInTheDocument();
  expect(within(details).queryByRole("button", { name: /Send|Save|Complete|Resolve|Mark/i })).not.toBeInTheDocument();
  fireEvent.click(within(details).getByRole("button", { name: "Open Candidate" }));
  expect(onOpenCandidate).toHaveBeenCalledWith("candidate-exact", "req-exact", expect.objectContaining({ candidateId: "candidate-exact", requisitionId: "req-exact" }));
  expect(onTaskAction).not.toHaveBeenCalled();
  expect(onWorkspaceEvent).not.toHaveBeenCalled();
});

test("moves Manager Feedback from pending to overdue without remounting", () => {
  const tracker = [{
    id: "candidate-live-feedback",
    candidate: "Synthetic Live Feedback Candidate",
    status: "Interview Completed",
    nextAction: "Request feedback",
    actualInterviewAt: "2026-07-21T12:00:01.000Z",
    candidateNotes: "Interview complete",
    currentOwner: "Synthetic Manager",
    ownerType: "Hiring Manager",
    requisitionId: "req-live-feedback",
    position: "RN",
    site: "Synthetic Facility",
    facilityId: "facility-live-feedback",
  }];
  render(<RecruiterWorkspacePage
    theme={theme}
    tracker={tracker}
    requisitions={[{ id: "req-live-feedback", reqNumber: "SYN-LIVE", positionTitle: "RN", siteName: "Synthetic Facility", facilityId: "facility-live-feedback", status: "Active" }]}
    sites={[{ id: "facility-live-feedback", siteName: "Synthetic Facility", status: "Active", hiringManagerEmail: "manager@example.test" }]}
    workflowRules={{ interviewFeedbackHours: 24 }}
    onOpenCandidate={jest.fn()}
    onOpenRequisition={jest.fn()}
    onOpenWeeklyCleanup={jest.fn()}
    onOpenReports={jest.fn()}
  />);
  expect(screen.getByText("Manager feedback pending for Synthetic Live Feedback Candidate")).toBeInTheDocument();
  act(() => {
    jest.advanceTimersByTime(1000);
  });
  expect(screen.getByText("Manager feedback overdue for Synthetic Live Feedback Candidate")).toBeInTheDocument();
});

test("routes missing facility contact review with the exact facility context", () => {
  const onOpenFacility = jest.fn();
  render(<RecruiterWorkspacePage
    theme={theme}
    tracker={[]}
    requisitions={[{ id: "req-contact", reqNumber: "SYN-2003", positionTitle: "CNA", siteName: "No Contact Facility", facilityId: "facility-contact", status: "Active" }]}
    sites={[{ id: "facility-contact", siteName: "No Contact Facility", regionName: "Synthetic Region", status: "Active" }]}
    onOpenCandidate={jest.fn()}
    onOpenRequisition={jest.fn()}
    onOpenFacility={onOpenFacility}
    onOpenWeeklyCleanup={jest.fn()}
    onOpenReports={jest.fn()}
  />);
  const filters = screen.getByRole("tablist", { name: "Action Center filters" });
  fireEvent.click(within(filters).getByRole("tab", { name: /Data Blockers/i }));
  expect(screen.getByText("Facility contact is missing")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Open Facility" }));
  expect(onOpenFacility).toHaveBeenCalledWith("facility-contact", expect.objectContaining({ issueCode: "facility-recipient-missing", facilityId: "facility-contact" }));
});

test("shows Candidate Ready work without exposing a send or status action", () => {
  render(<RecruiterWorkspacePage
    theme={theme}
    tracker={[{
      id: "candidate-ready",
      candidate: "Synthetic Ready Candidate",
      status: "Ready for Facility Submission",
      nextAction: "Send facility submission",
      candidateNotes: "Reviewed",
      requisitionId: "req-ready",
      position: "RN",
      site: "Synthetic Facility",
      facilityId: "facility-ready",
      reviewedSubmissionPackage: { rendered: {}, recipients: {}, snapshot: {} },
      communicationActionStates: { facilitySubmission: "Ready to Send" },
    }]}
    requisitions={[{ id: "req-ready", reqNumber: "SYN-2004", positionTitle: "RN", siteName: "Synthetic Facility", facilityId: "facility-ready", status: "Active" }]}
    sites={[{ id: "facility-ready", siteName: "Synthetic Facility", status: "Active", hiringManagerEmail: "manager@example.test" }]}
    onOpenCandidate={jest.fn()}
    onOpenRequisition={jest.fn()}
    onOpenWeeklyCleanup={jest.fn()}
    onOpenReports={jest.fn()}
  />);
  const filters = screen.getByRole("tablist", { name: "Action Center filters" });
  fireEvent.click(within(filters).getByRole("tab", { name: /Candidate Ready/i }));
  const panel = screen.getByRole("tabpanel", { name: /Candidate Ready Action Center items/i });
  expect(within(panel).getByText(/Candidate Ready submission pending for Synthetic Ready Candidate/i)).toBeInTheDocument();
  expect(within(panel).queryByRole("button", { name: /Send|Mark Sent|Complete/i })).not.toBeInTheDocument();
});

test("opens an exact read-only candidate follow-up communication preview", () => {
  const onTaskAction = jest.fn();
  const onWorkspaceEvent = jest.fn();
  render(<RecruiterWorkspacePage
    theme={theme}
    tracker={[{
      id: "candidate-preview-follow-up",
      candidate: "Synthetic Preview Candidate",
      candidateEmail: "candidate@example.test",
      candidateType: "External",
      candidateTypeConfirmed: true,
      status: "Submitted",
      nextAction: "Follow up with candidate",
      nextActionDueDate: "2026-07-21",
      lastActionAt: "2026-07-18T12:00:00.000Z",
      currentOwner: "Recruiter",
      ownerType: "Recruiter",
      requisitionId: "req-preview-follow-up",
      facilityId: "facility-preview-follow-up",
      site: "Synthetic Preview Facility",
      position: "RN",
    }]}
    requisitions={[{ id: "req-preview-follow-up", reqNumber: "SYN-PREVIEW", positionTitle: "RN", facilityId: "facility-preview-follow-up", siteName: "Synthetic Preview Facility", status: "Active" }]}
    sites={[{ id: "facility-preview-follow-up", siteName: "Synthetic Preview Facility", regionName: "Synthetic Region", status: "Active", hiringManagerEmail: "manager@example.test" }]}
    communicationSettings={{ general: { recruiterName: "Synthetic Recruiter" }, templates: { candidate48HourFollowUp: { subject: "Checking in | {candidate_name}", body: "Hello {candidate_name}, following up about {position} at {facility}." } } }}
    onOpenCandidate={jest.fn()}
    onOpenRequisition={jest.fn()}
    onOpenWeeklyCleanup={jest.fn()}
    onOpenReports={jest.fn()}
    onTaskAction={onTaskAction}
    onWorkspaceEvent={onWorkspaceEvent}
  />);

  fireEvent.click(screen.getByRole("button", { name: /Review details for Recruiter follow-up due for Synthetic Preview Candidate/i }));
  fireEvent.click(screen.getByRole("button", { name: "Preview Communication" }));
  const dialog = screen.getByRole("dialog", { name: "Candidate Follow-Up Preview" });
  expect(within(dialog).getByText("candidate-preview-follow-up")).toBeInTheDocument();
  expect(within(dialog).getByText("req-preview-follow-up")).toBeInTheDocument();
  expect(within(dialog).getByText("candidate@example.test")).toBeInTheDocument();
  expect(within(dialog).getByText("Checking in | Synthetic Preview Candidate")).toBeInTheDocument();
  expect(within(dialog).getByText(/Nothing can be copied, opened, sent, saved, or marked complete/i)).toBeInTheDocument();
  expect(within(dialog).queryByRole("button", { name: /Copy|Open|Send|Save|Complete|Approve/i })).not.toBeInTheDocument();
  expect(onTaskAction).not.toHaveBeenCalled();
  expect(onWorkspaceEvent).not.toHaveBeenCalled();
});

test("previews manager feedback with the canonical facility recipient", () => {
  render(<RecruiterWorkspacePage
    theme={theme}
    tracker={[{
      id: "candidate-preview-feedback",
      candidate: "Synthetic Feedback Candidate",
      candidateEmail: "candidate@example.test",
      status: "Interview Completed",
      nextAction: "Request feedback",
      actualInterviewAt: "2026-07-20T12:00:00.000Z",
      currentOwner: "Synthetic Manager",
      ownerType: "Hiring Manager",
      requisitionId: "req-preview-feedback",
      facilityId: "facility-preview-feedback",
      site: "Synthetic Feedback Facility",
      position: "LPN",
    }]}
    requisitions={[{ id: "req-preview-feedback", reqNumber: "SYN-FEEDBACK", positionTitle: "LPN", facilityId: "facility-preview-feedback", siteName: "Synthetic Feedback Facility", status: "Active" }]}
    sites={[{ id: "facility-preview-feedback", siteName: "Synthetic Feedback Facility", status: "Active", hiringManagerEmail: "manager@example.test" }]}
    communicationSettings={{ general: { recruiterName: "Synthetic Recruiter" }, templates: { managerFeedbackRequest: { subject: "Feedback | {candidate_name}", body: "Please share feedback for {candidate_name} after {interview_date}." } } }}
    onOpenCandidate={jest.fn()}
    onOpenRequisition={jest.fn()}
    onOpenWeeklyCleanup={jest.fn()}
    onOpenReports={jest.fn()}
  />);

  fireEvent.click(screen.getByRole("button", { name: /Review details for Manager feedback overdue for Synthetic Feedback Candidate/i }));
  fireEvent.click(screen.getByRole("button", { name: "Preview Communication" }));
  const dialog = screen.getByRole("dialog", { name: "Manager Feedback Preview" });
  expect(within(dialog).getByText("manager@example.test")).toBeInTheDocument();
  expect(within(dialog).getByText("Feedback | Synthetic Feedback Candidate")).toBeInTheDocument();
  expect(within(dialog).getByText(/2026-07-20/)).toBeInTheDocument();
});

test("previews the exact saved Candidate Ready package without operational controls", () => {
  render(<RecruiterWorkspacePage
    theme={theme}
    tracker={[{
      id: "candidate-preview-ready",
      candidate: "Synthetic Ready Preview",
      status: "Ready for Facility Submission",
      requisitionId: "req-preview-ready",
      facilityId: "facility-preview-ready",
      site: "Synthetic Ready Facility",
      position: "CNA",
      reviewedSubmissionPackage: {
        snapshotHash: "saved-ready-hash",
        recipients: { facility: { to: ["manager@example.test"], cc: [] }, candidate: { to: ["candidate@example.test"] } },
        rendered: {
          facilityEmail: { subject: "Saved facility subject", body: "Saved facility body" },
          candidateEmail: { subject: "Saved candidate subject", body: "Saved candidate body" },
          candidateText: { body: "Saved candidate text" },
          atsUpdate: { subject: "Saved ATS subject", body: "Saved ATS body" },
        },
      },
      communicationActionStates: { facilitySubmission: "Ready to Send" },
    }]}
    requisitions={[{ id: "req-preview-ready", reqNumber: "SYN-READY", positionTitle: "CNA", facilityId: "facility-preview-ready", siteName: "Synthetic Ready Facility", status: "Active" }]}
    sites={[{ id: "facility-preview-ready", siteName: "Synthetic Ready Facility", status: "Active", hiringManagerEmail: "manager@example.test" }]}
    onOpenCandidate={jest.fn()}
    onOpenRequisition={jest.fn()}
    onOpenWeeklyCleanup={jest.fn()}
    onOpenReports={jest.fn()}
  />);

  const filters = screen.getByRole("tablist", { name: "Action Center filters" });
  fireEvent.click(within(filters).getByRole("tab", { name: /Candidate Ready/i }));
  fireEvent.click(screen.getByRole("button", { name: /Review details for Candidate Ready submission pending for Synthetic Ready Preview/i }));
  fireEvent.click(screen.getByRole("button", { name: "Preview Communication" }));
  const dialog = screen.getByRole("dialog", { name: "Candidate Ready Preview" });
  expect(within(dialog).getByText("Saved facility body")).toBeInTheDocument();
  expect(within(dialog).getByText("Saved candidate body")).toBeInTheDocument();
  expect(within(dialog).getByText("Saved candidate text")).toBeInTheDocument();
  expect(within(dialog).getByText("Saved ATS body")).toBeInTheDocument();
  expect(within(dialog).getByText("saved-ready-hash")).toBeInTheDocument();
  expect(within(dialog).queryByRole("button", { name: /Copy|Open|Send|Save|Complete|Approve/i })).not.toBeInTheDocument();
});

test("renders a clear Action Center empty state", () => {
  render(<RecruiterWorkspacePage theme={theme} tracker={[]} requisitions={[]} sites={[]} onOpenCandidate={jest.fn()} onOpenRequisition={jest.fn()} onOpenWeeklyCleanup={jest.fn()} onOpenReports={jest.fn()} />);
  const filters = screen.getByRole("tablist", { name: "Action Center filters" });
  fireEvent.click(within(filters).getByRole("tab", { name: /Manager Feedback/i }));
  expect(screen.getByText("No manager feedback items need attention right now.")).toBeInTheDocument();
});

test("builds exact application setup targets without falling back to another record", () => {
  const requisitions = [{ id: "req-exact", reqNumber: "SYN-3001", positionTitle: "RN" }];
  const sites = [{ id: "facility-exact", siteName: "Exact Facility", status: "Active" }];
  expect(resolveActionCenterSetupTarget({ type: "requisition", id: "req-exact", requisitions, sites })).toMatchObject({
    ok: true,
    target: { recordType: "requisition", recordId: "req-exact", field: "reqNumber" },
  });
  expect(resolveActionCenterSetupTarget({ type: "facility", id: "facility-exact", requisitions, sites })).toMatchObject({
    ok: true,
    target: { recordType: "facility", recordId: "facility-exact", field: "siteName" },
  });
  expect(resolveActionCenterSetupTarget({ type: "requisition", id: "req-missing", requisitions, sites })).toMatchObject({ ok: false });
  expect(resolveActionCenterSetupTarget({ type: "facility", id: "facility-missing", requisitions, sites })).toMatchObject({ ok: false });
  expect(resolveActionCenterSetupTarget({ type: "requisition", id: "req-exact", requisitions: [...requisitions, ...requisitions], sites })).toMatchObject({ ok: false });
  expect(resolveActionCenterSetupTarget({ type: "facility", id: "facility-exact", requisitions, sites: [...sites, ...sites] })).toMatchObject({ ok: false });
});

test("resolves an exact candidate and requisition pair without duplicate-ID fallback", () => {
  const requisitions = [
    { id: "req-one", reqNumber: "SYN-ONE", positionTitle: "RN" },
    { id: "req-two", reqNumber: "SYN-TWO", positionTitle: "LPN" },
  ];
  const tracker = [
    { id: "candidate-shared", requisitionId: "req-one", candidate: "Synthetic One" },
    { id: "candidate-shared", reqId: "req-two", candidate: "Synthetic Two" },
  ];
  expect(resolveActionCenterCandidateTarget({ candidateId: "candidate-shared", requisitionId: "req-two", tracker, requisitions })).toMatchObject({
    ok: true,
    candidate: { candidate: "Synthetic Two" },
    target: { candidateId: "candidate-shared", requisitionId: "req-two" },
  });
  expect(resolveActionCenterCandidateTarget({ candidateId: "candidate-shared", requisitionId: "", tracker, requisitions })).toMatchObject({ ok: false });
  expect(resolveActionCenterCandidateTarget({ candidateId: "candidate-missing", requisitionId: "req-two", tracker, requisitions })).toMatchObject({ ok: false });
  expect(resolveActionCenterCandidateTarget({ candidateId: "candidate-shared", requisitionId: "req-missing", tracker, requisitions })).toMatchObject({ ok: false });
  expect(resolveActionCenterCandidateTarget({ candidateId: "candidate-shared", requisitionId: "req-one", tracker: [...tracker, { ...tracker[0] }], requisitions })).toMatchObject({ ok: false });
});

test("keeps Action Center navigation separate while both candidate paths preserve exact requisition context", () => {
  const onOpenCandidate = jest.fn();
  const onOpenActionCenterCandidate = jest.fn();
  render(<RecruiterWorkspacePage
    theme={theme}
    tracker={[{
      id: "candidate-dual-navigation",
      candidate: "Synthetic Dual Navigation",
      status: "Submitted",
      nextAction: "Follow up with candidate",
      nextActionDueDate: "2026-07-20",
      lastActionAt: "2026-07-18T12:00:00.000Z",
      candidateNotes: "Synthetic note",
      currentOwner: "Recruiter",
      requisitionId: "req-dual-navigation",
      reqNumber: "SYN-DUAL",
      position: "Registered Nurse",
      site: "Synthetic Facility",
      facilityId: "facility-dual-navigation",
    }]}
    requisitions={[{
      id: "req-dual-navigation",
      reqNumber: "SYN-DUAL",
      positionTitle: "Registered Nurse",
      siteName: "Synthetic Facility",
      facilityId: "facility-dual-navigation",
      status: "Active",
      openings: 1,
    }]}
    sites={[{
      id: "facility-dual-navigation",
      siteName: "Synthetic Facility",
      status: "Active",
      hiringManagerName: "Synthetic Manager",
      hiringManagerEmail: "manager@example.test",
    }]}
    onOpenCandidate={onOpenCandidate}
    onOpenActionCenterCandidate={onOpenActionCenterCandidate}
    onOpenRequisition={jest.fn()}
    onOpenWeeklyCleanup={jest.fn()}
    onOpenReports={jest.fn()}
  />);

  const [actionCenterOpen, workQueueOpen] = screen.getAllByRole("button", { name: "Open Candidate" });
  fireEvent.click(actionCenterOpen);
  expect(onOpenActionCenterCandidate).toHaveBeenCalledWith(
    "candidate-dual-navigation",
    "req-dual-navigation",
    expect.objectContaining({ candidateId: "candidate-dual-navigation", requisitionId: "req-dual-navigation" }),
  );
  expect(onOpenCandidate).not.toHaveBeenCalled();

  fireEvent.click(workQueueOpen);
  expect(onOpenCandidate).toHaveBeenCalledWith(
    "candidate-dual-navigation",
    "req-dual-navigation",
    expect.objectContaining({ sourceId: "candidate-dual-navigation", requisitionId: "req-dual-navigation" }),
  );
  expect(onOpenActionCenterCandidate).toHaveBeenCalledTimes(1);
});

test("uses the complete Action Center requisition collection to expose a missing-number blocker", () => {
  const onOpenActionCenterRequisition = jest.fn();
  render(<RecruiterWorkspacePage
    theme={theme}
    tracker={[]}
    requisitions={[]}
    actionCenterRequisitions={[{
      id: "req-missing-number",
      reqNumber: "",
      uniqueIdNumber: "",
      positionTitle: "Registered Nurse",
      siteName: "Synthetic Facility",
      facilityId: "facility-missing-number",
      status: "Active",
      openings: 1,
    }]}
    sites={[{
      id: "facility-missing-number",
      siteName: "Synthetic Facility",
      status: "Active",
      hiringManagerName: "Synthetic Manager",
      hiringManagerEmail: "manager@example.test",
    }]}
    onOpenCandidate={jest.fn()}
    onOpenRequisition={jest.fn()}
    onOpenActionCenterRequisition={onOpenActionCenterRequisition}
    onOpenWeeklyCleanup={jest.fn()}
    onOpenReports={jest.fn()}
  />);

  const filters = screen.getByRole("tablist", { name: "Action Center filters" });
  fireEvent.click(within(filters).getByRole("tab", { name: /Data Blockers/i }));
  expect(screen.getByText("Req Number or Unique ID is missing")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Open Requisition" }));
  expect(onOpenActionCenterRequisition).toHaveBeenCalledWith(
    "req-missing-number",
    expect.objectContaining({ issueCode: "missing-requisition-number", requisitionId: "req-missing-number" }),
  );
});

test("makes Action Center navigation supersede stale reporting correction state", () => {
  const candidateTarget = { candidateId: "candidate-exact", requisitionId: "req-exact" };
  const setupTarget = { recordType: "facility", recordId: "facility-exact" };
  expect(actionCenterNavigationState({ candidateTarget })).toEqual({
    reportCorrectionTarget: null,
    actionCenterCandidateTarget: candidateTarget,
    actionCenterSetupTarget: null,
  });
  expect(actionCenterNavigationState({ setupTarget })).toEqual({
    reportCorrectionTarget: null,
    actionCenterCandidateTarget: null,
    actionCenterSetupTarget: setupTarget,
  });
});

test("clears an old requisition target before ordinary navigation to the same candidate on another requisition", () => {
  const staleTarget = { candidateId: "candidate-shared", requisitionId: "req-one" };
  expect(actionCenterNavigationState({ candidateTarget: staleTarget }).actionCenterCandidateTarget).toEqual(staleTarget);
  expect(clearedActionCenterTargets()).toEqual({
    actionCenterCandidateTarget: null,
    actionCenterSetupTarget: null,
  });
});

test("expires an Action Center candidate target when an ordinary candidate selection changes", () => {
  const candidateTarget = { candidateId: "candidate-one", requisitionId: "req-one" };
  expect(activeActionCenterCandidateTargetForSelection({ candidateTarget, selectedId: "candidate-one" })).toBe(candidateTarget);
  expect(activeActionCenterCandidateTargetForSelection({ candidateTarget, selectedId: "candidate-two" })).toBeNull();
});

test("disables an unavailable requisition target instead of opening a generic setup screen", () => {
  const onOpenRequisition = jest.fn();
  render(<RecruiterWorkspacePage
    theme={theme}
    tracker={[]}
    requisitions={[{ id: "", reqNumber: "SYN-NO-ID", positionTitle: "RN", siteName: "Synthetic Facility", facilityId: "facility-no-id", status: "Active" }]}
    sites={[{ id: "facility-no-id", siteName: "Synthetic Facility", status: "Active", hiringManagerEmail: "manager@example.test" }]}
    onOpenCandidate={jest.fn()}
    onOpenRequisition={onOpenRequisition}
    onOpenWeeklyCleanup={jest.fn()}
    onOpenReports={jest.fn()}
  />);
  const unavailable = screen.getByRole("button", { name: "Target unavailable" });
  expect(unavailable).toBeDisabled();
  fireEvent.click(unavailable);
  expect(onOpenRequisition).not.toHaveBeenCalled();
});

test("signals that an exact Action Center setup target was opened so its navigation state can be consumed", () => {
  const onNavigationTargetOpened = jest.fn();
  render(<FacilityPositionSetupPage
    settings={{
      sites: [{
        id: "facility-consumed",
        siteName: "Synthetic Facility",
        aliases: [],
        regionId: "synthetic-region",
        status: "Active",
        additionalHiringManagers: [],
        siteSpecificQuestions: [],
      }],
      requisitions: [{
        id: "req-consumed",
        reqNumber: "SYN-CONSUMED",
        uniqueIdNumber: "SYN-UNIQUE-CONSUMED",
        positionTitle: "Registered Nurse",
        siteName: "Synthetic Facility",
        facilityId: "facility-consumed",
        status: "Active",
      }],
      reporting: { regions: [{ id: "synthetic-region", name: "Synthetic Region", active: true }], reportPresets: [] },
      contacts: [],
      options: { featureFlags: {}, shiftOptions: ["Day"], requisitionStatusOptions: ["Active", "Filled", "Closed"] },
      compensationStructure: { rules: [], enabledDimensions: [] },
      communicationSettings: {},
    }}
    setSettings={jest.fn()}
    correctionTarget={{
      action: "Review Requisition",
      page: "positions",
      tab: "positions",
      recordType: "requisition",
      recordId: "req-consumed",
      field: "reqNumber",
      label: "SYN-CONSUMED",
    }}
    onNavigationTargetOpened={onNavigationTargetOpened}
  />);

  act(() => {
    jest.advanceTimersByTime(60);
  });
  expect(screen.getByRole("heading", { name: "Edit Requisition" })).toBeInTheDocument();
  expect(onNavigationTargetOpened).toHaveBeenCalledTimes(1);
});
