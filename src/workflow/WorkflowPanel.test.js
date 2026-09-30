import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import WorkflowPanel from "./WorkflowPanel";
import { isConfirmedCompletion } from "./completion";
const client = {
  auth: {
    getSession: jest.fn(async () => ({
      data: { session: { access_token: "test-token" } },
    })),
    onAuthStateChange: () => ({
      data: { subscription: { unsubscribe: () => {} } },
    }),
  },
};
const view = {
  actor: { role: "manager", userId: "manager" },
  policy: { version: 1 },
  cases: [
    {
      id: "case",
      name: "Synthetic Candidate",
      status: "manager_decision",
      stageIndex: -1,
      version: 1,
      stages: [{ id: "stage", name: "Driver interview", feedback: [] }],
      canDecide: true,
      canRecruit: false,
      packet: "Reviewed packet",
    },
  ],
  jobs: [],
  exceptions: [],
  requisitions: [],
  members: [],
  people: [],
  catalog: { requisitions: [], candidates: [] },
};
const response = (body) => ({
  ok: true,
  status: 200,
  json: async () => ({ ok: true, ...body }),
});
const originalFetch = global.fetch;
beforeEach(() => {
  client.auth.getSession.mockResolvedValue({
    data: { session: { access_token: "test-token" } },
  });
  let n = 0;
  Object.defineProperty(global, "crypto", {
    configurable: true,
    value: { randomUUID: () => `uuid-${++n}` },
  });
});
afterEach(() => {
  global.fetch = originalFetch;
});
test("uncertain network result retries the same command and does not show false completion", async () => {
  const calls = [];
  let fail = true;
  global.fetch = jest.fn(async (url, options) => {
    if (!options.body) return response({ view });
    calls.push(JSON.parse(options.body));
    if (fail) {
      fail = false;
      throw new Error("Connection interrupted");
    }
    return response({
      view: {
        ...view,
        cases: [
          {
            ...view.cases[0],
            status: "slots_needed",
            stageIndex: 0,
            version: 2,
          },
        ],
      },
    });
  });
  render(<WorkflowPanel client={client} workspaceId="test" />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Proceed", exact: true }),
  );
  expect(
    await screen.findByText(/action has not been confirmed/),
  ).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Check and retry pending action" }),
  );
  await screen.findByText("Offer interview times");
  expect(calls).toHaveLength(2);
  expect(calls[0]).toEqual(calls[1]);
});
test("candidate check-in contains the disclaimer and submits interest without deciding hiring", async () => {
  let command;
  global.fetch = jest.fn(async (url, options) => {
    if (options.body) {
      command = JSON.parse(options.body);
      return response({ completed: true });
    }
    return response({
      view: {
        caseId: "case",
        expectedVersion: 3,
        purpose: "experience",
        stageName: "Driver interview",
        requisition: "Driver",
        slots: [],
        responded: false,
      },
    });
  });
  render(
    <WorkflowPanel client={client} workspaceId="test" token="scoped-link" />,
  );
  expect(
    await screen.findByText(/not an offer or hiring decision/),
  ).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Are you still interested?"), {
    target: { value: "no" },
  });
  fireEvent.change(
    screen.getByLabelText("How was the interview or facility experience?"),
    { target: { value: "negative" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Submit response" }));
  await screen.findByText("Thank you. Your response has been recorded.");
  expect(command.type).toBe("experience");
  expect(command.payload.interested).toBe("no");
  expect(command.payload.decision).toBeUndefined();
});
test("a stale action clears the pending retry and asks for refresh", async () => {
  global.fetch = jest.fn(async (url, options) =>
    options.body
      ? {
          ok: false,
          status: 409,
          json: async () => ({ ok: false, error: "Refresh before deciding." }),
        }
      : response({ view }),
  );
  render(<WorkflowPanel client={client} workspaceId="test" />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Proceed", exact: true }),
  );
  await screen.findByRole("alert");
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Check and retry pending action" }),
    ).not.toBeInTheDocument(),
  );
});
test("copying and opening a draft never establish completion", () => {
  expect(isConfirmedCompletion("Copied")).toBe(false);
  expect(isConfirmedCompletion("Draft Opened")).toBe(false);
  expect(isConfirmedCompletion("Sent")).toBe(true);
  expect(isConfirmedCompletion("Manually Confirmed")).toBe(true);
});
