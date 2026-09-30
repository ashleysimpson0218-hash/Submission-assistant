import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { RecruiterEnablementPage, RecruiterIndustrySetupCard } from "./RecruiterEnablementPage";
import { LoginPage } from "./App";

const theme = { panel: "#fff", panelAlt: "#fafafa", border: "#ddd", text: "#111", muted: "#555", primary2: "#6d28d9" };
function props(overrides = {}) { return { settings: {}, theme, saveStatus: { label: "Session only", detail: "Saving disabled" }, onApplyIndustry: jest.fn(), onNavigate: jest.fn(), onOpenSettings: jest.fn(), completedLessons: [], onCompleteLesson: jest.fn(), section: "learn", onSectionChange: jest.fn(), ...overrides }; }

test("authenticated account setup requires a choice and does not depend on demo login", () => {
  const onApplyIndustry = jest.fn();
  render(<RecruiterIndustrySetupCard settings={{}} theme={theme} onApplyIndustry={onApplyIndustry} />);
  expect(screen.getByRole("button", { name: "Use this industry" })).toBeDisabled();
  fireEvent.change(screen.getByRole("combobox", { name: "Recruiting industry" }), { target: { value: "hospitality" } });
  fireEvent.click(screen.getByRole("button", { name: "Use this industry" }));
  expect(onApplyIndustry).toHaveBeenCalledWith("hospitality");
  expect(screen.getByRole("status")).toHaveTextContent("Industry applied to this workspace");
});

test("recruiter account setup requires an explicit industry and passes the selected industry to setup", () => {
  const onEnter = jest.fn();
  render(<LoginPage mode="signup" setMode={jest.fn()} onEnter={onEnter} soundEnabled={false} setSoundEnabled={jest.fn()} />);
  expect(screen.getByRole("button", { name: "Create Account" })).toBeDisabled();
  const selector = screen.getByRole("combobox", { name: "Recruiting industry" });
  expect(selector).toHaveValue("");
  fireEvent.change(selector, { target: { value: "professional" } });
  fireEvent.click(screen.getByRole("button", { name: "Create Account" }));
  expect(onEnter).toHaveBeenCalledWith({ industryId: "professional" });
});

test("industry preview does not apply changes until the recruiter clicks apply", () => {
  const options = props({ section: "industry" });
  render(<RecruiterEnablementPage {...options} />);
  fireEvent.change(screen.getByRole("combobox", { name: "Industry" }), { target: { value: "trucking" } });
  expect(options.onApplyIndustry).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Apply industry profile" }));
  expect(options.onApplyIndustry).toHaveBeenCalledWith("trucking");
  expect(screen.getByRole("status")).toHaveTextContent("Trucking & Logistics applied");
});

test("training routes to real working pages and marks only the selected lesson reviewed", () => {
  const options = props();
  render(<RecruiterEnablementPage {...options} />);
  fireEvent.click(screen.getByRole("button", { name: "Open my work" }));
  expect(options.onNavigate).toHaveBeenCalledWith("home");
  fireEvent.click(screen.getByRole("button", { name: "Mark reviewed & continue" }));
  expect(options.onCompleteLesson).toHaveBeenCalledWith("daily");
  expect(screen.getByRole("heading", { name: "Capture a candidate once" })).toBeInTheDocument();
});

test("practice enforces review and completes without candidate writes, navigation, or message actions", () => {
  const options = props();
  render(<RecruiterEnablementPage {...options} />);
  expect(screen.getByRole("button", { name: "Prepare practice draft" })).toBeDisabled();
  fireEvent.change(screen.getByRole("textbox", { name: "What needs to happen next?" }), { target: { value: "Confirm the manager's decision timing" } });
  fireEvent.click(screen.getByRole("button", { name: "Prepare practice draft" }));
  expect(screen.getByRole("button", { name: "Record practice handoff" })).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox", { name: /I checked the candidate/ }));
  fireEvent.click(screen.getByRole("button", { name: "Record practice handoff" }));
  expect(screen.getByRole("status")).toHaveTextContent("Draft reviewed. Nothing sent.");
  expect(options.onNavigate).not.toHaveBeenCalled();
  expect(options.onApplyIndustry).not.toHaveBeenCalled();
});

test("connections do not mistake configured links for verified integrations", () => {
  render(<RecruiterEnablementPage {...props({ section: "connections", settings: { general: { defaultBookingLink: "https://example.test/book" } } })} />);
  expect(screen.getByText("Booking link configured")).toBeInTheDocument();
  expect(screen.getByText(/does not establish two-way calendar synchronization/)).toBeInTheDocument();
  expect(screen.getByText("Manual handoff")).toBeInTheDocument();
});

test("help search has an empty state and preserves input", () => {
  render(<RecruiterEnablementPage {...props({ section: "help" })} />);
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzzz" } });
  expect(screen.getByRole("status")).toHaveTextContent("No matching guide");
  expect(screen.getByRole("searchbox")).toHaveValue("zzzz");
});
