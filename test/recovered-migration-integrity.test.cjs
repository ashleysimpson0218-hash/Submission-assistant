// File-integrity tests only. This file never opens a database or executes SQL.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'docs/recovered-migration-provenance.json'), 'utf8'));
const expected = new Map([
  ['20261017195452', 'd74cf6b8999bf17543fa8658d96280b59c44a99e240005bbe2ce83cc96b9ef84'],
  ['20261018033142', 'e16316641fcaa9b5b91371af98f6764a9e2f490e5de10ecaadd07e4dd313cfb7'],
]);

for (const [version, sha256] of expected) {
  test(`recorded migration ${version} preserves its exact recovered bytes`, () => {
    const entries = manifest.migrations.filter((entry) => entry.version === version);
    assert.equal(entries.length, 1, 'There must be one provenance entry per recovered version.');
    const entry = entries[0];
    assert.match(entry.name, /^[a-z0-9_]+$/);
    assert.equal(entry.file, `supabase/migrations/${version}_${entry.name}.sql`);
    const bytes = fs.readFileSync(path.join(root, entry.file));
    assert.equal(bytes.length, entry.bytes);
    assert.equal(entry.sha256, sha256);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), sha256);
    // MD5 is only an equality check against the returned database history.
    assert.equal(crypto.createHash('md5').update(bytes).digest('hex'), entry.database_md5);
  });
}

test('each recovered version has exactly one migration filename', () => {
  assert.equal(manifest.migrations.length, expected.size);
  const files = fs.readdirSync(path.join(root, 'supabase/migrations'));
  for (const version of expected.keys()) {
    const entry = manifest.migrations.find((item) => item.version === version);
    assert.deepEqual(files.filter((name) => name.startsWith(`${version}_`)), [path.basename(entry.file)]);
  }
});
