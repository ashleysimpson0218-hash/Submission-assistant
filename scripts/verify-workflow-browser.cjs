/* Local browser acceptance checks with synthetic API responses only.
 * No cloud workspace, auth service, or email provider is contacted. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const server = spawn(
  process.execPath,
  [require.resolve("react-scripts/scripts/start")],
  {
    cwd: path.join(__dirname, ".."),
    detached: true,
    env: {
      ...process.env,
      BROWSER: "none",
      HOST: "127.0.0.1",
      PORT: "3105",
      REACT_APP_ENVIRONMENT: "test",
      REACT_APP_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
      REACT_APP_SUPABASE_ANON_KEY: "synthetic-local-key",
      REACT_APP_ALLOWED_SUPABASE_PROJECT_REF: "abcdefghijklmnopqrst",
      REACT_APP_WELCOMEFLOW_WORKSPACE_ID: "synthetic-workflow-review",
      REACT_APP_WELCOMEFLOW_AUTOSAVE: "false",
      REACT_APP_WELCOMEFLOW_WORKFLOW_ENABLED: "true",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
const ready = new Promise((resolve, reject) => {
  const timer = setTimeout(
    () => reject(new Error("Local dev server did not become ready")),
    90000,
  );
  server.stdout.on("data", (data) => {
    if (String(data).includes("Compiled successfully")) {
      clearTimeout(timer);
      resolve();
    }
  });
  server.on("exit", (code) => {
    clearTimeout(timer);
    if (code) reject(new Error("Dev server exited " + code));
  });
});
let runningBrowser;
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
async function main() {
  await ready;
  const browser = (runningBrowser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  }));
  const errors = [],
    requests = [];
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    timezoneId: "America/New_York",
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  const base = process.env.WORKFLOW_LOCAL_URL || "http://127.0.0.1:3105";
  assert.match(base, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
  const expires = Math.floor(Date.now() / 1000) + 86400;
  const jwt = [
    "eyJhbGciOiJIUzI1NiJ9",
    Buffer.from(
      JSON.stringify({ exp: expires, sub: "synthetic-manager" }),
    ).toString("base64url"),
    "synthetic-signature",
  ].join(".");
  await context.addInitScript(
    ({ jwt, expires }) =>
      localStorage.setItem(
        "welcomeflow-auth-abcdefghijklmnopqrst",
        JSON.stringify({
          access_token: jwt,
          refresh_token: "synthetic-refresh",
          expires_at: expires,
          expires_in: 86400,
          token_type: "bearer",
          user: {
            id: "synthetic-manager",
            email: "manager@example.test",
            aud: "authenticated",
          },
        }),
      ),
    { jwt, expires },
  );
  let view = {
    actor: { role: "manager", userId: "synthetic-manager" },
    policy: { version: 1 },
    cases: [
      {
        id: "case",
        name: "Synthetic Driver Candidate",
        status: "manager_decision",
        stageIndex: -1,
        version: 1,
        stages: [
          {
            id: "stage",
            name: "Driver interview",
            feedback: [],
            ownerId: "synthetic-manager",
            interviewerIds: [],
          },
        ],
        canDecide: true,
        canParticipate: true,
        canRecruit: false,
        packet: "Recruiter-approved synthetic packet.",
      },
    ],
    jobs: [],
    exceptions: [],
    requisitions: [],
    members: [],
    people: [],
    catalog: { requisitions: [], candidates: [] },
  };
  const candidate = {
    caseId: "case",
    expectedVersion: 3,
    purpose: "booking",
    stageName: "Driver interview",
    requisition: "Synthetic Driver",
    slots: [
      {
        id: "slot",
        start: "2026-10-05T14:00:00.000Z",
        end: "2026-10-05T15:00:00.000Z",
      },
    ],
  };
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== base) return route.abort();
    if (url.pathname === "/api/workflow") {
      const request = route.request();
      const token = request.headers()["x-welcomeflow-candidate-token"];
      if (request.method() === "POST") {
        const cmd = request.postDataJSON();
        requests.push(cmd);
        if (token)
          return route.fulfill({ json: { ok: true, completed: true } });
        if (cmd.type === "decision")
          view = {
            ...view,
            cases: [
              {
                ...view.cases[0],
                status: "slots_needed",
                stageIndex: 0,
                version: 2,
              },
            ],
          };
        else if (cmd.type === "offer_slots")
          view = {
            ...view,
            cases: [
              { ...view.cases[0], status: "selection_pending", version: 3 },
            ],
          };
      }
      return route.fulfill({
        json: {
          ok: true,
          view: token
            ? {
                ...candidate,
                purpose: token === "experience" ? "experience" : "booking",
              }
            : view,
        },
      });
    }
    return route.continue();
  });
  const output = path.join(__dirname, "../docs/validation");
  fs.mkdirSync(output, { recursive: true });
  await page.goto(`${base}/workflow`);
  await page.getByRole("button", { name: "Proceed", exact: true }).waitFor();
  await page.getByRole("button", { name: "Proceed", exact: true }).click();
  await page.getByText("Offer interview times", { exact: true }).waitFor();
  await page
    .getByLabel("Interview location or joining link")
    .fill("https://video.example.test/interview");
  await page
    .getByLabel("Preparation information")
    .fill("Review the role and bring your questions.");
  await page.getByLabel("Slot start").fill("2026-10-05T10:00");
  await page.getByLabel("Slot end").fill("2026-10-05T11:00");
  await page.getByRole("button", { name: "Add time", exact: true }).click();
  await page.getByRole("button", { name: "Send offered times" }).click();
  await page
    .getByText("Replace offered interview times", { exact: true })
    .waitFor();
  await page.keyboard.press("Control+Home");
  await page.screenshot({
    path: path.join(output, "workflow-manager-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  await page.keyboard.press("Control+Home");
  await page.screenshot({
    path: path.join(output, "workflow-manager-mobile.png"),
    fullPage: true,
  });
  await page.goto(
    `${base}/workflow?workspace=synthetic-workflow-review&token=booking`,
  );
  await page.getByLabel("Choose an interview time").selectOption("slot");
  await page.getByRole("button", { name: "Submit response" }).click();
  await page.getByText("Thank you. Your response has been recorded.").waitFor();
  await page.goto(
    `${base}/workflow?workspace=synthetic-workflow-review&token=experience`,
  );
  await page.getByLabel("Are you still interested?").selectOption("no");
  await page
    .getByLabel("How was the interview or facility experience?")
    .selectOption("negative");
  await page.getByLabel("I would like recruiting or HR to follow up.").check();
  await page.keyboard.press("Control+Home");
  await page.screenshot({
    path: path.join(output, "workflow-candidate-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Submit response" }).click();
  await page.getByText("Thank you. Your response has been recorded.").waitFor();
  assert.deepEqual(
    requests.map((r) => r.type),
    ["decision", "offer_slots", "book", "experience"],
  );
  assert.equal(
    requests[1].payload.instructions,
    "Review the role and bring your questions.",
  );
  assert.equal(requests[3].payload.interested, "no");
  assert.equal(requests[3].payload.decision, undefined);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  await page.goto(base);
  await page.getByText("WelcomeFlow", { exact: false }).first().waitFor();
  assert.equal(
    await page.locator("#webpack-dev-server-client-overlay").count(),
    0,
  );
  assert.deepEqual(errors, []);
  await browser.close();
  console.log(
    "PASS: desktop and 390px mobile manager actions, supplied-slot form, candidate booking, candidate experience submission, root route, no horizontal overflow or page errors. Synthetic API only.",
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await runningBrowser?.close();
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {}
  });
