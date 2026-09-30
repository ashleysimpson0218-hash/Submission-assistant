/* Explicitly started by an operator in an approved environment. Not a deployment hook. */
const { setTimeout: delay } = require("node:timers/promises");
async function main() {
  const origin = process.env.WELCOMEFLOW_WORKER_ORIGIN;
  const workspaceId = process.env.WELCOMEFLOW_WORKER_WORKSPACE_ID;
  const secret = process.env.WELCOMEFLOW_WORKFLOW_WORKER_SECRET;
  if (
    !/^https:\/\/[^/]+$/.test(origin || "") ||
    !workspaceId ||
    secret?.length < 32 ||
    !secret
  )
    throw new Error(
      "Set an approved HTTPS origin, workspace, and worker secret before starting.",
    );
  const once = process.argv.includes("--once");
  do {
    try {
      const response = await fetch(`${origin}/api/workflow-worker`, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(60000),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({ workspaceId }),
      });
      const body = await response.json();
      console.log(
        JSON.stringify({
          at: new Date().toISOString(),
          status: response.status,
          ok: body.ok === true,
          processed: body.processed || 0,
          code: body.code || null,
        }),
      );
      if (once && !response.ok) process.exitCode = 1;
    } catch {
      console.error(
        "Workflow worker unavailable. Pending work remains in the shared store; investigate the failed run.",
      );
      if (once) process.exitCode = 1;
    }
    if (!once) await delay(60000);
  } while (!once);
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
