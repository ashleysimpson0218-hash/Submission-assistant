import { render, screen } from "@testing-library/react";
import { ConfigurationErrorPage, OwnerUatFrame, TestModeFrame } from "./RuntimeGate";

test("configuration error is visible without rendering the application", () => {
  render(<ConfigurationErrorPage message="Missing required configuration." />);
  expect(screen.getByRole("alert")).toHaveTextContent("Missing required configuration.");
});

test("Owner UAT banner identifies real data, controlled writes, and disabled outbound actions", () => {
  render(<OwnerUatFrame><main>Owner application</main></OwnerUatFrame>);
  expect(screen.getByRole("status")).toHaveTextContent(/REAL PRODUCTION DATA COPY — CONTROLLED WRITES/);
  expect(screen.getByRole("status")).toHaveTextContent(/Do not contact candidates/);
  expect(screen.getByRole("status")).toHaveTextContent(/disabled/);
});

test("persistent synthetic-data banner is displayed in the mode frame", () => {
  render(<TestModeFrame><main>Test application</main></TestModeFrame>);
  expect(screen.getByRole("status")).toHaveTextContent("TEST MODE — SYNTHETIC DATA ONLY");
  expect(screen.getByTestId("test-mode-frame")).toHaveTextContent("Test application");
});
