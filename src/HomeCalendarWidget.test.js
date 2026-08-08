import { fireEvent, render, screen } from "@testing-library/react";
import { HomeCalendarWidget } from "./HomeCalendarWidget";

const theme = {
  panel: "#fff", panelAlt: "#f7f4ff", borderSoft: "#ddd", shadow: "none", text: "#17112f", muted: "#6b6680",
  primary2: "#6d28d9",
};

const timezone = process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone;
const isNewYork = timezone === "America/New_York";

function eventAt(hoursFromNow, overrides = {}) {
  const start = new Date(Date.now() + hoursFromNow * 3600000);
  const end = new Date(start.getTime() + 30 * 60000);
  return {
    id: `event-${hoursFromNow}`,
    eventType: "Candidate Phone Screen",
    title: "Synthetic Phone Screen",
    startDateTime: start.toISOString(),
    endDateTime: end.toISOString(),
    recruiterId: "current-recruiter",
    candidateName: "Synthetic Candidate",
    position: "Synthetic LPN",
    facilityName: "Synthetic Facility",
    ...overrides,
  };
}

afterEach(() => {
  jest.useRealTimers();
});

test("renders a compact internal agenda and opens its linked event", () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-07-27T16:00:00.000Z"));
  const onOpenEvent = jest.fn();
  render(<HomeCalendarWidget theme={theme} events={[eventAt(1)]} onAddEvent={jest.fn()} onOpenCalendar={jest.fn()} onOpenEvent={onOpenEvent} />);
  expect(screen.getByRole("region", { name: "Today and Upcoming" })).toBeInTheDocument();
  expect(screen.getByText("Internal recruiting calendar")).toBeInTheDocument();
  fireEvent.click(screen.getByText("Candidate Phone Screen"));
  expect(onOpenEvent).toHaveBeenCalledWith(expect.objectContaining({ id: "event-1", calendarProvider: "internal" }));
});

test("filters the Home agenda to interviews and exposes scheduling actions", () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-07-27T16:00:00.000Z"));
  const onAddEvent = jest.fn();
  render(<HomeCalendarWidget
    theme={theme}
    events={[
      eventAt(1),
      eventAt(2, { id: "interview-1", eventType: "Facility Interview", title: "Synthetic Interview" }),
    ]}
    onAddEvent={onAddEvent}
    onOpenCalendar={jest.fn()}
    onOpenEvent={jest.fn()}
  />);
  fireEvent.click(screen.getByRole("tab", { name: "Interviews" }));
  expect(screen.getByText("Facility Interview")).toBeInTheDocument();
  expect(screen.queryByText("Candidate Phone Screen")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Schedule Interview" }));
  expect(onAddEvent).toHaveBeenCalled();
});

test("groups an evening New York interview on the selected local date and the next UTC date under UTC", () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-07-27T22:44:00.000Z"));
  const interview = eventAt(2, { id: "interview-midnight", eventType: "Facility Interview", title: "Synthetic Evening Interview" });
  const sourceBefore = JSON.stringify(interview);
  render(<HomeCalendarWidget
    theme={theme}
    events={[interview]}
    onAddEvent={jest.fn()}
    onOpenCalendar={jest.fn()}
    onOpenEvent={jest.fn()}
  />);
  fireEvent.click(screen.getByRole("tab", { name: "Interviews" }));

  expect(Boolean(screen.queryByText("Facility Interview"))).toBe(isNewYork);
  fireEvent.click(screen.getByRole("button", { name: /T 28/ }));
  expect(Boolean(screen.queryByText("Facility Interview"))).toBe(!isNewYork);
  expect(JSON.stringify(interview)).toBe(sourceBefore);
});

test("invalid event dates fail safely without mutating source events", () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-07-27T16:00:00.000Z"));
  const invalidEvent = {
    id: "invalid-date",
    eventType: "Facility Interview",
    title: "Invalid event",
    startDateTime: "not-a-date",
    endDateTime: "",
    recruiterId: "current-recruiter",
  };
  const sourceBefore = JSON.stringify(invalidEvent);
  expect(() => render(<HomeCalendarWidget
    theme={theme}
    events={[invalidEvent]}
    onAddEvent={jest.fn()}
    onOpenCalendar={jest.fn()}
    onOpenEvent={jest.fn()}
  />)).not.toThrow();
  expect(JSON.stringify(invalidEvent)).toBe(sourceBefore);
});
