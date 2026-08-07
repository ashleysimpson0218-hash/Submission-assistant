import { fireEvent, render, screen } from "@testing-library/react";
import { InternalCalendarPage } from "./InternalCalendarPage";

const theme = {
  panel: "#fff", panelAlt: "#f7f4ff", borderSoft: "#ddd", border: "#ccc", shadow: "none", text: "#17112f", muted: "#6b6680",
  primary2: "#6d28d9", red: "#dc2626", amber: "#d97706", amberBg: "#fef3c7",
};

function futureEvent(overrides = {}) {
  const start = new Date(Date.now() + 2 * 3600000);
  const end = new Date(start.getTime() + 3600000);
  return {
    id: "calendar-1",
    eventType: "Facility Interview",
    title: "Synthetic Interview",
    startDateTime: start.toISOString(),
    endDateTime: end.toISOString(),
    candidateId: "candidate-1",
    candidateName: "Synthetic Candidate",
    requisitionId: "req-1",
    facilityId: "facility-1",
    facilityName: "Synthetic Facility",
    position: "Synthetic LPN",
    recruiterId: "current-recruiter",
    ...overrides,
  };
}

const commonProps = {
  theme,
  candidates: [{ id: "candidate-1", candidate: "Synthetic Candidate", requisitionId: "req-1", facilityId: "facility-1" }],
  requisitions: [{ id: "req-1", reqNumber: "100", positionTitle: "Synthetic LPN", facilityId: "facility-1", siteName: "Synthetic Facility" }],
  sites: [{ id: "facility-1", siteName: "Synthetic Facility" }],
  onOpenCandidate: jest.fn(),
  onOpenRequisition: jest.fn(),
  onDownloadInvitation: jest.fn(),
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-07-27T22:44:00.000Z"));
});

afterEach(() => {
  jest.useRealTimers();
});

test("creates an internal calendar event from the full Calendar page", () => {
  const onCreateEvent = jest.fn(() => ({ ok: true, conflicts: [] }));
  render(<InternalCalendarPage {...commonProps} events={[]} onCreateEvent={onCreateEvent} onUpdateEvent={jest.fn()} />);
  expect(screen.getByText(/external availability is not connected/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "+ Add Event" }));
  fireEvent.change(screen.getByLabelText("Candidate"), { target: { value: "candidate-1" } });
  fireEvent.click(screen.getByRole("button", { name: "Save Event" }));
  expect(onCreateEvent).toHaveBeenCalledWith(expect.objectContaining({
    candidateId: "candidate-1",
    calendarProvider: "internal",
    externalCalendarId: null,
    externalEventId: null,
  }));
});

test("records outcomes and exports an internal invitation without external sync controls", () => {
  const event = futureEvent();
  const source = JSON.parse(JSON.stringify(event));
  const onUpdateEvent = jest.fn(() => ({ ok: true }));
  const onDownloadInvitation = jest.fn();
  render(<InternalCalendarPage {...commonProps} events={[event]} onCreateEvent={jest.fn()} onUpdateEvent={onUpdateEvent} onDownloadInvitation={onDownloadInvitation} />);
  fireEvent.change(screen.getByLabelText("Outcome for Synthetic Interview"), { target: { value: "Attended" } });
  expect(onUpdateEvent).toHaveBeenCalledWith("calendar-1", { outcomeStatus: "Attended" }, "outcome");
  fireEvent.click(screen.getByRole("button", { name: "Export .ics" }));
  expect(onDownloadInvitation).toHaveBeenCalledWith(expect.objectContaining({ id: "calendar-1" }));
  expect(screen.queryByText(/Connect Outlook|Connect Google|Microsoft 365/i)).not.toBeInTheDocument();
  expect(event).toEqual(source);
});

test("opens a prefilled scheduling form from a connected candidate action", () => {
  render(<InternalCalendarPage
    {...commonProps}
    events={[]}
    createRequestToken={1}
    createPrefill={{ eventType: "Facility Interview", candidateId: "candidate-1", requisitionId: "req-1", facilityId: "facility-1" }}
    onCreateEvent={jest.fn(() => ({ ok: true }))}
    onUpdateEvent={jest.fn()}
  />);
  expect(screen.getByRole("dialog", { name: "Create calendar event" })).toBeInTheDocument();
  expect(screen.getByLabelText("Candidate")).toHaveValue("candidate-1");
  expect(screen.getByLabelText("Requisition")).toHaveValue("req-1");
  expect(screen.getByLabelText("Facility", { selector: 'select[aria-label="Facility"]' })).toHaveValue("facility-1");
});
