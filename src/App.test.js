import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders the WelcomeFlow shell", () => {
  render(<App />);

  expect(screen.getAllByText(/Recruiting Assistant/i).length).toBeGreaterThan(0);
  expect(screen.getByRole("button", { name: /Turn sounds off/i })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /Welcome back/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Sign In/i })).toBeInTheDocument();
});
