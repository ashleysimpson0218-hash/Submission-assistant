/* Isolated PostgreSQL-compatible acceptance test. Never connects to a remote database.
 * Install @electric-sql/pglite in a temporary directory and set PGLITE_MODULE to its path. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
async function main() {
  const { PGlite } = require(
    process.env.PGLITE_MODULE || "@electric-sql/pglite",
  );
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 alter default privileges grant all on tables to anon,authenticated,service_role;
 alter default privileges grant all on sequences to anon,authenticated,service_role;
 create table public.welcomeflow_workspace_state(workspace_id text primary key,data jsonb,updated_at timestamptz not null);
 grant select,update on public.welcomeflow_workspace_state to service_role;
 insert into public.welcomeflow_workspace_state values('test','{}','2026-09-24T14:00:00Z');`);
  await db.exec(
    fs.readFileSync(
      path.join(
        __dirname,
        "../supabase/migrations/20260924014711_revision_5_workflow_foundation.sql",
      ),
      "utf8",
    ),
  );
  const user = "00000000-0000-4000-8000-000000000001";
  await db.query(
    `insert into public.welcomeflow_workflow_members(workspace_id,user_id,role,display_name,email,timezone) values('test',$1,'admin','Test Admin','admin@example.com','UTC')`,
    [user],
  );
  const call = async ({
    id = "one",
    revision = 0,
    fingerprint = "a".repeat(64),
    version = 1,
    source = "2026-09-24T14:00:00Z",
    events,
  } = {}) =>
    (
      await db.query(
        `select public.welcomeflow_commit_workflow($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) as result`,
        [
          "test",
          revision,
          id,
          fingerprint,
          user,
          "admin",
          version,
          source,
          JSON.stringify({ revision: revision + 1, schema: 1 }),
          JSON.stringify(
            events || [
              {
                type: "test.event",
                actorId: user,
                actorRole: "admin",
                occurredAt: "2026-09-24T14:00:00Z",
              },
            ],
          ),
        ],
      )
    ).rows[0].result;
  await db.exec("set role service_role");
  assert.equal((await call()).status, "committed");
  assert.equal((await call()).status, "duplicate");
  assert.equal(
    (await call({ fingerprint: "b".repeat(64) })).status,
    "command_conflict",
  );
  assert.equal((await call({ id: "stale" })).status, "revision_conflict");
  assert.equal(
    (await call({ id: "source", revision: 1, source: "2026-09-23T14:00:00Z" }))
      .status,
    "source_conflict",
  );
  await assert.rejects(
    call({
      id: "rollback",
      revision: 1,
      events: [
        {
          type: "valid",
          actorId: user,
          actorRole: "admin",
          occurredAt: "2026-09-24T14:00:00Z",
        },
        {
          type: "forged",
          actorId: "different",
          actorRole: "admin",
          occurredAt: "2026-09-24T14:00:00Z",
        },
      ],
    }),
    /actor must match/,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int as n from public.welcomeflow_workflow_commands",
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int as n from public.welcomeflow_workflow_events",
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await db.query(
        "select revision::int from public.welcomeflow_workflow_state",
      )
    ).rows[0].revision,
    1,
  );
  await db.exec(
    "update public.welcomeflow_workflow_members set active=false where workspace_id='test'",
  );
  assert.equal(
    (await call({ id: "revoked", revision: 1 })).status,
    "unauthorized",
  );
  assert.equal(
    (
      await db.query(
        "select version::int from public.welcomeflow_workflow_members",
      )
    ).rows[0].version,
    2,
  );
  await assert.rejects(
    db.exec("delete from public.welcomeflow_workflow_events"),
    /permission denied/,
  );
  await assert.rejects(
    db.exec("update public.welcomeflow_workflow_events set type='changed'"),
    /permission denied/,
  );
  for (const table of ["welcomeflow_workflow_commands", "welcomeflow_workflow_events"]) {
    for (const privilege of ["UPDATE", "DELETE", "TRUNCATE"]) {
      const result = await db.query(
        "select has_table_privilege('service_role', $1, $2) as allowed",
        ["public." + table, privilege],
      );
      assert.equal(result.rows[0].allowed, false, `${table}: ${privilege} denied`);
    }
  }
  for (const role of ["anon", "authenticated"]) {
    const result = await db.query(
      "select has_sequence_privilege($1, 'public.welcomeflow_workflow_events_event_id_seq', 'USAGE') as allowed",
      [role],
    );
    assert.equal(result.rows[0].allowed, false);
  }
  await db.exec("reset role");
  const rls = await db.query(
    "select relname,relrowsecurity from pg_class where relname in ('welcomeflow_workflow_state','welcomeflow_workflow_members','welcomeflow_workflow_commands','welcomeflow_workflow_events')",
  );
  assert.equal(rls.rows.length, 4);
  assert.ok(rls.rows.every((r) => r.relrowsecurity));
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}`);
    await assert.rejects(
      db.query("select * from public.welcomeflow_workflow_state"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select * from public.welcomeflow_workflow_members"),
      /permission denied/,
    );
    await assert.rejects(call(), /permission denied/);
    await db.exec("reset role");
  }
  await db.close();
  console.log(
    "PASS: SQL migration, atomic rollback, deduplication, stale revision/source checks, membership revocation, immutable audit grants, and private RLS boundaries.",
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
