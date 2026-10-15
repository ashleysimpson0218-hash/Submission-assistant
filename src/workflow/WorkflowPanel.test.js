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
test("structured API errors never render as object text", async () => {
  global.fetch = jest.fn(async () => ({
    ok: false,
    status: 503,
    json: async () => ({ ok: false, error: { message: "Workflow setup needs attention." } }),
  }));
  render(<WorkflowPanel client={client} workspaceId="test" />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Workflow setup needs attention.");
  expect(screen.queryByText("[object Object]")).not.toBeInTheDocument();
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

test('email decline link opens its candidate reason form without recording any decision', async () => {
  global.fetch = jest.fn(async () => response({ view: {...view, cases:[...view.cases, {...view.cases[0],id:'other-case',name:'Other candidate'}]} }));
  render(<WorkflowPanel client={client} workspaceId="test" entry={{caseId:'case',action:'decline',version:'1'}} />);
  await screen.findByLabelText('Decline reason');
  expect(screen.queryByText('Other candidate')).not.toBeInTheDocument();
  expect(global.fetch.mock.calls.every(([,o]) => o.method === 'GET')).toBe(true);
  fireEvent.change(screen.getByLabelText('Decline reason'), {target:{value:'Insufficient experience'}});
  fireEvent.click(screen.getByRole('button',{name:'Record decline and notify recruiter'}));
  await waitFor(() => expect(global.fetch.mock.calls.some(([,o]) => o.method === 'POST')).toBe(true));
  const command = JSON.parse(global.fetch.mock.calls.find(([,o]) => o.method === 'POST')[1].body);
  expect(command.payload.caseId).toBe('case');
  expect(command.payload.decision).toBe('decline');
});

test('old email version requires current review before a manager can submit', async () => {
  global.fetch = jest.fn(async () => response({view}));
  render(<WorkflowPanel client={client} workspaceId="test" entry={{caseId:'case',action:'hold',version:'0'}} />);
  expect(await screen.findByRole('button',{name:'Hold for other candidate review'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'Review current candidate'}));
  expect(screen.getByRole('button',{name:'Hold for other candidate review'})).not.toBeDisabled();
});

test('manager-selected times record Proceed and send the invitation in one command', async () => {
  const schedulingView = {
    ...view,
    cases: [{
      ...view.cases[0],
      stages: [{
        ...view.cases[0].stages[0],
        location: 'https://teams.example.test/interview',
        instructions: 'Bring your license and questions.',
      }],
    }],
  };
  global.fetch = jest.fn(async () => response({view:schedulingView}));
  render(<WorkflowPanel client={client} workspaceId="test" entry={{caseId:'case',action:'proceed-times',version:'1'}} />);
  expect(await screen.findByLabelText('Interview location or joining link')).toHaveValue('https://teams.example.test/interview');
  expect(screen.getByLabelText('Preparation information')).toHaveValue('Bring your license and questions.');
  expect(global.fetch.mock.calls.every(([,o]) => o.method === 'GET')).toBe(true);
  fireEvent.change(screen.getByLabelText('Calendar month'),{target:{value:'2027-03'}});
  fireEvent.click(screen.getByRole('button',{name:'Select Monday, March 1, 2027'}));
  fireEvent.click(screen.getByRole('button',{name:'Select Monday, March 15, 2027'}));
  fireEvent.click(screen.getByRole('button',{name:'Select Sunday, March 21, 2027'}));
  fireEvent.change(screen.getByLabelText('Start time'),{target:{value:'10:00'}});
  fireEvent.change(screen.getByLabelText('End time'),{target:{value:'11:00'}});
  fireEvent.click(screen.getByRole('button',{name:'Add time range'}));
  expect(screen.getByText('Review offered times (3 of 10)')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Proceed and send interview invitation'}));
  await waitFor(() => expect(global.fetch.mock.calls.some(([,o]) => o.method === 'POST')).toBe(true));
  const commands = global.fetch.mock.calls.filter(([,o]) => o.method === 'POST');
  expect(commands).toHaveLength(1);
  const command = JSON.parse(commands[0][1].body);
  expect(command.type).toBe('proceed_with_slots');
  expect(command.payload.caseId).toBe('case');
  expect(command.payload.location).toBe('https://teams.example.test/interview');
  expect(command.payload.instructions).toBe('Bring your license and questions.');
  expect(command.payload.slots).toHaveLength(3);
});

test('manager can assign different time ranges to individual selected dates', async () => {
  const schedulingView = {
    ...view,
    cases: [{
      ...view.cases[0],
      stages: [{
        ...view.cases[0].stages[0],
        location: 'Demo Facility',
        instructions: 'Bring questions.',
      }],
    }],
  };
  global.fetch = jest.fn(async () => response({view:schedulingView}));
  render(<WorkflowPanel client={client} workspaceId="test" entry={{caseId:'case',action:'proceed-times',version:'1'}} />);
  await screen.findByLabelText('Calendar month');
  fireEvent.change(screen.getByLabelText('Calendar month'),{target:{value:'2027-03'}});
  fireEvent.click(screen.getByRole('button',{name:'Select Monday, March 1, 2027'}));
  fireEvent.click(screen.getByRole('button',{name:'Select Monday, March 15, 2027'}));
  fireEvent.click(screen.getByLabelText('Apply selected times to all selected days'));
  fireEvent.click(screen.getByRole('button',{name:'Mar 1'}));
  fireEvent.change(screen.getByLabelText('Start time'),{target:{value:'09:00'}});
  fireEvent.change(screen.getByLabelText('End time'),{target:{value:'10:00'}});
  fireEvent.click(screen.getByRole('button',{name:'Add time range'}));
  fireEvent.click(screen.getByRole('button',{name:'Mar 15'}));
  fireEvent.change(screen.getByLabelText('Start time'),{target:{value:'13:00'}});
  fireEvent.change(screen.getByLabelText('End time'),{target:{value:'14:00'}});
  fireEvent.click(screen.getByRole('button',{name:'Add time range'}));
  expect(screen.getByText('Review offered times (2 of 10)')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Proceed and send interview invitation'}));
  await waitFor(() => expect(global.fetch.mock.calls.some(([,o]) => o.method === 'POST')).toBe(true));
  const command = JSON.parse(global.fetch.mock.calls.find(([,o]) => o.method === 'POST')[1].body);
  expect(command.payload.slots).toHaveLength(2);
  expect(command.payload.slots[0].start).not.toBe(command.payload.slots[1].start);
});

test('manager scheduling reuses location and preparation from a prior candidate on the requisition', async () => {
  const target = {
    ...view.cases[0],
    requisitionId: 'req-1',
    stages: [{...view.cases[0].stages[0], location:'', instructions:''}],
  };
  const prior = {
    ...view.cases[0],
    id: 'prior-case',
    requisitionId: 'req-1',
    stages: [{
      ...view.cases[0].stages[0],
      location: 'Facility conference room',
      instructions: 'Ask for the nursing director at reception.',
    }],
  };
  global.fetch = jest.fn(async () => response({view:{...view,cases:[target,prior]}}));
  render(<WorkflowPanel client={client} workspaceId="test" entry={{caseId:'case',action:'proceed-times',version:'1'}} />);
  expect(await screen.findByLabelText('Interview location or joining link')).toHaveValue('Facility conference room');
  expect(screen.getByLabelText('Preparation information')).toHaveValue('Ask for the nursing director at reception.');
});

test('the queued manager email can be processed without creating a second handoff', async () => {
  const queuedView = {
    ...view,
    jobs: [{
      id:'case:-1:decision_request:',
      kind:'decision_request',
      caseId:'case',
      recipientId:'manager',
      status:'queued',
      dueAt:'2020-01-01T00:00:00.000Z',
    }],
  };
  global.fetch = jest.fn(async () => response({view:queuedView}));
  render(<WorkflowPanel client={client} workspaceId="test" />);
  fireEvent.click(await screen.findByRole('button',{name:'Process pending email'}));
  await waitFor(() => expect(global.fetch.mock.calls.some(([,options]) => options.method === 'POST')).toBe(true));
  const command = JSON.parse(global.fetch.mock.calls.find(([,options]) => options.method === 'POST')[1].body);
  expect(command.type).toBe('process_queued_delivery');
  expect(command.payload).toEqual({caseId:'case',jobId:'case:-1:decision_request:'});
});
