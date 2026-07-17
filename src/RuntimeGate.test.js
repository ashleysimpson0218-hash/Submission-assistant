import { render, screen } from "@testing-library/react";
import { ConfigurationErrorPage, TestModeFrame } from "./RuntimeGate";

test("configuration error is visible without rendering the application", () => {
  render(<ConfigurationErrorPage message="Missing required configuration." />);
  expect(screen.getByRole("alert")).toHaveTextContent("Missing required configuration.");
});

test("persistent synthetic-data banner is displayed in the mode frame", () => {
  render(<TestModeFrame><main>Test application</main></TestModeFrame>);
  expect(screen.getByRole("status")).toHaveTextContent("TEST MODE — SYNTHETIC DATA ONLY");
  expect(screen.getByTestId("test-mode-frame")).toHaveTextContent("Test application");
});
