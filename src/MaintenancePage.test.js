import { render, screen } from "@testing-library/react";
import MaintenancePage, { isMaintenanceModeEnabled } from "./MaintenancePage";

test("renders only the required private-development message", () => {
  render(<MaintenancePage />);

  expect(screen.getByRole("heading", { name: "WelcomeFlow is currently in private development." })).toBeInTheDocument();
  expect(screen.getByText("Access is temporarily unavailable while security and testing updates are completed.")).toBeInTheDocument();
  expect(screen.queryByText(/sign in/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/google/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/password/i)).not.toBeInTheDocument();
});

test("enables maintenance mode only for the explicit true flag", () => {
  const original = process.env.REACT_APP_MAINTENANCE_MODE;
  process.env.REACT_APP_MAINTENANCE_MODE = "true";
  expect(isMaintenanceModeEnabled()).toBe(true);
  process.env.REACT_APP_MAINTENANCE_MODE = "false";
  expect(isMaintenanceModeEnabled()).toBe(false);
  if (original === undefined) delete process.env.REACT_APP_MAINTENANCE_MODE;
  else process.env.REACT_APP_MAINTENANCE_MODE = original;
});

test.each([undefined, "", "false", "invalid"])("production remains in maintenance when the client flag is %p", (flag) => {
  const env = {};
  if (flag !== undefined) env.REACT_APP_MAINTENANCE_MODE = flag;
  expect(isMaintenanceModeEnabled({ environment: "production" }, env)).toBe(true);
});

test("preview does not inherit production maintenance behavior", () => {
  expect(isMaintenanceModeEnabled({ environment: "preview" }, { REACT_APP_MAINTENANCE_MODE: "false" })).toBe(false);
});
