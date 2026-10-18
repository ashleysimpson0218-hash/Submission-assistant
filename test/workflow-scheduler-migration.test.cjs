const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migration = fs.readFileSync(path.join(
  __dirname,
  '../supabase/migrations/20261017014000_schedule_revision_5_workflow_worker.sql',
), 'utf8');

test('workflow scheduler uses five-minute Supabase Cron with Vault-backed authorization', () => {
  assert.match(migration, /create extension if not exists pg_cron/i);
  assert.match(migration, /create extension if not exists pg_net/i);
  assert.match(migration, /'\*\/5 \* \* \* \*'/);
  assert.match(migration, /vault\.decrypted_secrets[\s\S]+welcomeflow_worker_origin/i);
  assert.match(migration, /vault\.decrypted_secrets[\s\S]+welcomeflow_worker_secret/i);
  assert.match(migration, /'Authorization', 'Bearer ' \|\| worker_secret/);
  assert.match(migration, /\/api\/workflow-schedule/);
});

test('workflow scheduler migration contains no deployment URL or secret value', () => {
  assert.doesNotMatch(migration, /https:\/\/[a-z0-9]/i);
  assert.doesNotMatch(migration, /central54llc|chicagoroxi|revision5-connected-synthetic/i);
  assert.match(migration, /revoke all on schema welcomeflow_private from public, anon, authenticated/i);
  assert.match(migration, /revoke all on function welcomeflow_private\.schedule_workflow_worker\(\) from public, anon, authenticated/i);
});
