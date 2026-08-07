import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import OwnerUatAuthGate from "./OwnerUatAuthGate";

const mockMaybeSingle = jest.fn();
const mockEq = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn(() => ({ select: mockSelect }));
const mockGetSession = jest.fn();
const mockSignIn = jest.fn();
const mockSignOut = jest.fn();
const mockReset = jest.fn();
const mockUpdateUser = jest.fn();
const mockOnAuthStateChange = jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } }));

const client = {
  from: mockFrom,
  auth: { getSession: mockGetSession, signInWithPassword: mockSignIn, signOut: mockSignOut, resetPasswordForEmail: mockReset, updateUser: mockUpdateUser, onAuthStateChange: mockOnAuthStateChange },
};

jest.mock("./supabaseRuntimeClient", () => ({ getRuntimeSupabaseClient: () => global.__ownerUatTestClient }));

beforeEach(() => {
  jest.clearAllMocks();
  global.__ownerUatTestClient = client;
  mockEq.mockImplementation(() => ({ maybeSingle: mockMaybeSingle }));
  mockSelect.mockImplementation(() => ({ eq: mockEq }));
  mockFrom.mockImplementation(() => ({ select: mockSelect }));
  mockOnAuthStateChange.mockImplementation(() => ({ data: { subscription: { unsubscribe: jest.fn() } } }));
  process.env.REACT_APP_ENVIRONMENT = "uat";
  process.env.REACT_APP_SUPABASE_URL = "https://zleslkwnbjxknmkqywyv.supabase.co";
  process.env.REACT_APP_SUPABASE_ANON_KEY = "synthetic-publishable-key";
  process.env.REACT_APP_ALLOWED_SUPABASE_PROJECT_REF = "zleslkwnbjxknmkqywyv";
  window.history.replaceState({}, "", "/");
  mockGetSession.mockResolvedValue({ data: { session: null } });
  mockMaybeSingle.mockResolvedValue({ data: { workspace_id: "default" }, error: null });
  mockSignOut.mockResolvedValue({ error: null });
  mockReset.mockResolvedValue({ error: null });
  mockUpdateUser.mockResolvedValue({ error: null });
});

test("shows owner password login with no signup action", async () => {
  render(<OwnerUatAuthGate><div>Workspace</div></OwnerUatAuthGate>);
  expect(await screen.findByRole("heading", { name: /Sign in to WelcomeFlow/ })).toBeInTheDocument();
  expect(screen.getByLabelText("Owner email")).toBeInTheDocument();
  expect(screen.getByLabelText("Password")).toBeInTheDocument();
  expect(screen.queryByText(/sign up/i)).not.toBeInTheDocument();
});

test("renders the workspace only after password login and owner membership verification", async () => {
  mockSignIn.mockResolvedValue({ data: { session: { user: { id: "synthetic-owner" } } }, error: null });
  render(<OwnerUatAuthGate><div>Authenticated workspace</div></OwnerUatAuthGate>);
  await screen.findByRole("heading", { name: /Sign in to WelcomeFlow/ });
  fireEvent.change(screen.getByLabelText("Owner email"), { target: { value: "owner@example.test" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "synthetic-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
  expect(await screen.findByText("Authenticated workspace")).toBeInTheDocument();
  expect(mockFrom).toHaveBeenCalledWith("welcomeflow_workspace_state");
  expect(mockEq).toHaveBeenCalledWith("workspace_id", "default");
});

test("rejects a valid Supabase session without Owner UAT membership", async () => {
  mockSignIn.mockResolvedValue({ data: { session: { user: { id: "not-owner" } } }, error: null });
  mockMaybeSingle.mockResolvedValue({ data: null, error: { code: "42501" } });
  render(<OwnerUatAuthGate><div>Authenticated workspace</div></OwnerUatAuthGate>);
  await screen.findByRole("heading", { name: /Sign in to WelcomeFlow/ });
  fireEvent.change(screen.getByLabelText("Owner email"), { target: { value: "other@example.test" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "synthetic-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
  await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
  expect(screen.queryByText("Authenticated workspace")).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent(/could not verify/);
});

test("password reset requests do not disclose whether an account exists", async () => {
  render(<OwnerUatAuthGate><div>Workspace</div></OwnerUatAuthGate>);
  await screen.findByRole("heading", { name: /Sign in to WelcomeFlow/ });
  fireEvent.change(screen.getByLabelText("Owner email"), { target: { value: "owner@example.test" } });
  fireEvent.click(screen.getByRole("button", { name: "Set or Reset Password" }));
  await waitFor(() => expect(mockReset).toHaveBeenCalledWith("owner@example.test", expect.objectContaining({ redirectTo: window.location.origin })));
  expect(await screen.findByRole("status")).toHaveTextContent(/If this is the approved/);
});
