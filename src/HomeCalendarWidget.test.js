import { fireEvent, render, screen } from "@testing-library/react";
import { HomeCalendarWidget } from "./HomeCalendarWidget";

const theme = {
  panel: "#fff", panelAlt: "#f7f4ff", borderSoft: "#ddd", shadow: "none", text: "#17112f", muted: "#6b6680",
  primary2: "#6d28d9",
};

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

test("renders a compact internal agenda and opens its linked event", () => {
  const onOpenEvent = jest.fn();
  render(<HomeCalendarWidget theme={theme} events={[eventAt(1)]} onAddEvent={jest.fn()} onOpenCalendar={jest.fn()} onOpenEvent={onOpenEvent} />);
  expect(screen.getByRole("region", { name: "Today and Upcoming" })).toBeInTheDocument();
  expect(screen.getByText("Internal recruiting calendar")).toBeInTheDocument();
  fireEvent.click(screen.getByText("Candidate Phone Screen"));
  expect(onOpenEvent).toHaveBeenCalledWith(expect.objectContaining({ id: "event-1", calendarProvider: "internal" }));
});

test("filters the Home agenda to interviews and exposes scheduling actions", () => {
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

