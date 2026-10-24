const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createWorkspaceSetupHandler, parseSave, FIELDS } = require('../server/workspaceSetupAccess');
const USER = '00000000-0000-4000-8000-000000000101';
const BEFORE = '2026-10-24T10:00:00.000001+00:00';
const AFTER = '2026-10-24T10:00:00.000002+00:00';
function fixture(overrides = {}, flags = {}) {
  const calls = [];
  const security = {
    readServerRuntimeConfig: () => ({ ok: true, environment: 'test', projectRef: 'bjverobaoujhfaylyrzi' }),
    requestPayloadBytes: (req) => Math.max(Buffer.byteLength(typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {})), Number(req.headers['content-length']) || 0),
    consumePreAuthenticationRateLimit: async () => { calls.push('preauth'); return { ok: true }; },
    authorizedRecruiter: async (req) => { calls.push('authorize'); return req.headers.authorization === 'Bearer test-token'
      && req.headers['x-welcomeflow-workspace-id'] === 'example-a'
      ? { user: { id: USER }, role: 'recruiter', workspaceId: 'example-a' } : { forbidden: true }; },
    consumeSharedRateLimits: async () => { calls.push('limit'); return { ok: true }; },
    serviceSupabaseClient: () => ({ rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: { status: args.p_operation === 'save' ? 'saved' : 'loaded', workspaceId: args.p_workspace_id,
        updatedAt: args.p_operation === 'save' ? AFTER : BEFORE, fields: { companyName: 'Example Company', ...args.p_changes } }, error: null };
    } }),
    ...overrides,
  };
  const handler = createWorkspaceSetupHandler(security, { WELCOMEFLOW_ENABLE_WORKSPACE_SETUP_ACTIONS: 'true', ...flags });
  const req = { method: 'POST', headers: { authorization: 'Bearer test-token', 'content-type': 'application/json', 'x-welcomeflow-workspace-id': 'example-a' },
    body: { expectedUpdatedAt: BEFORE, changes: { recruiterName: 'Example Recruiter' } } };
  async function run(change = {}) {
    let result;
    const res = { statusCode: 0, headers: {}, setHeader(k,v) { this.headers[k] = v; }, end(text) { result = JSON.parse(text); } };
    await handler({ ...req, ...change }, res);
    return { status: res.statusCode, headers: res.headers, body: result };
  }
  return { run, req, calls };
}
const rpcCalls = (f) => f.calls.filter((v) => typeof v === 'object');

test('authorized save passes only verified actor, exact workspace, fields, and version to RPC', async () => {
  const f = fixture(); const r = await f.run();
  assert.equal(r.status,200); assert.equal(r.body.updatedAt,AFTER);
  assert.deepEqual(rpcCalls(f)[0], { name: 'welcomeflow_access_workspace_setup', args: {
    p_actor_id: USER, p_actor_role: 'recruiter', p_workspace_id: 'example-a', p_operation: 'save',
    p_expected_updated_at: BEFORE, p_changes: { recruiterName: 'Example Recruiter' },
  } });
  assert.equal(r.headers['Cache-Control'],'no-store');
  assert.match(r.headers.Vary,/Authorization/);
});
test('read uses the same access checks and never sends a write operation', async () => {
  const f = fixture(); const r = await f.run({ method: 'GET', body: undefined });
  assert.equal(r.status,200); assert.equal(rpcCalls(f)[0].args.p_operation,'read');
  assert.deepEqual(rpcCalls(f)[0].args.p_changes,{}); assert.equal(rpcCalls(f)[0].args.p_expected_updated_at,null);
});
for (const flags of [{ WELCOMEFLOW_ENABLE_WORKSPACE_SETUP_ACTIONS: undefined }, { WELCOMEFLOW_ENABLE_WORKSPACE_SETUP_ACTIONS: 'TRUE' }, { WELCOMEFLOW_MAINTENANCE_MODE: 'true' }]) {
  test(`gate blocks without an exact enabled flag or during maintenance ${JSON.stringify(flags)}`, async () => {
    const f = fixture({},flags); assert.equal((await f.run()).status,503); assert.equal(f.calls.length,0);
  });
}
for (const runtime of [{ ok:false }, { ok:true,environment:'production',projectRef:'bjverobaoujhfaylyrzi' },
  { ok:true,environment:'owner-uat',projectRef:'bjverobaoujhfaylyrzi' }, { ok:true,environment:'acceptance',projectRef:'bjverobaoujhfaylyrzi' },
  { ok:true,environment:'test',projectRef:'another-project' }]) {
  test(`rejects unauthorized runtime ${JSON.stringify(runtime)}`, async () => {
    const f = fixture({ readServerRuntimeConfig: () => runtime });
    assert.equal((await f.run()).status,503); assert.equal(f.calls.length,0);
  });
}
test('rejects methods other than GET or POST', async () => {
  const f=fixture(); const r=await f.run({ method:'DELETE' }); assert.equal(r.status,405); assert.equal(f.calls.length,0);
});
test('rejects oversized bodies before authentication or RPC', async () => {
  const f=fixture(); assert.equal((await f.run({ body:'x'.repeat(8193) })).status,413); assert.equal(f.calls.length,0);
});
for (const [label, access, status] of [['expired token',{ error:'Expired' },401], ['removed member',{ forbidden:true },403],
  ['membership lookup unavailable',{ unavailable:true },503], ['manager role',{user:{id:USER},role:'manager',workspaceId:'example-a'},403]]) {
  test(`no RPC for ${label}`,async()=>{
    const f=fixture({ authorizedRecruiter:async()=>access }); assert.equal((await f.run()).status,status); assert.equal(rpcCalls(f).length,0);
  });
}
test('wrong workspace is denied without looking up setup fields',async()=>{
  const f=fixture(); assert.equal((await f.run({ headers:{...f.req.headers,'x-welcomeflow-workspace-id':'example-b'} })).status,403);
  assert.equal(rpcCalls(f).length,0);
});
for (const role of ['admin','recruiter']) {
  test(`current authorized ${role} can use the narrow setup operation`,async()=>{
    const f=fixture({authorizedRecruiter:async()=>({user:{id:USER},role,workspaceId:'example-a'})});
    assert.equal((await f.run()).status,200); assert.equal(rpcCalls(f)[0].args.p_actor_role,role);
  });
}
for (const [name,result,status] of [['consumePreAuthenticationRateLimit',{ok:false,limited:true},429],
  ['consumePreAuthenticationRateLimit',{ok:false,unavailable:true},503],['consumeSharedRateLimits',{ok:false,limited:true},429]]) {
  test(`rate protection ${name} ${status} prevents database operation`,async()=>{
    const f=fixture({[name]:async()=>result}); assert.equal((await f.run()).status,status); assert.equal(rpcCalls(f).length,0);
  });
}
for (const changes of [{ tracker:[] },{ role:'admin' },{ templates:{} },{ recruiterEmail:'bad\r\nBcc:someone@example.test' },
  { companyName:12 },{ includeSignatureLineInEmails:'true' },{ signOffLine:'x'.repeat(1001) },{},JSON.parse('{"__proto__":{}}')]) {
  test(`invalid or out-of-scope fields cannot reach RPC ${JSON.stringify(changes).slice(0,90)}`,async()=>{
    const f=fixture(); assert.equal((await f.run({body:{expectedUpdatedAt:BEFORE,changes}})).status,400); assert.equal(rpcCalls(f).length,0);
  });
}
test('does not accept browser-supplied actor or a whole workspace alongside valid fields',async()=>{
  const f=fixture(); const body={...f.req.body,p_actor_id:USER,workspace:{tracker:[]}};
  assert.equal((await f.run({body})).status,400); assert.equal(rpcCalls(f).length,0);
});
test('does not convert incomplete-but-valid form fields into an invalid save',()=>{
  assert.ok(parseSave({expectedUpdatedAt:BEFORE,changes:{recruiterEmail:'',companyName:'',includeSignatureLineInEmails:false}}));
});
test('requires JSON and a valid baseline version, handles malformed JSON safely',async()=>{
  const f=fixture(); assert.equal((await f.run({headers:{...f.req.headers,'content-type':'text/plain'}})).status,415);
  assert.equal((await f.run({body:'{not json'})).status,400);
  assert.equal((await f.run({body:{expectedUpdatedAt:'today',changes:{companyName:'Example'}}})).status,400);
  assert.equal(rpcCalls(f).length,0);
});
for (const [status,http] of [['forbidden',403],['conflict',409],['invalid',400],['unavailable',503],['something_else',503]]) {
  test(`maps database ${status} without exposing private details`,async()=>{
    const f=fixture({serviceSupabaseClient:()=>({rpc:async()=>({data:{status,details:'private-detail'}})})});
    const r=await f.run(); assert.equal(r.status,http); assert.doesNotMatch(JSON.stringify(r),/private-detail/);
  });
}
test('database error does not leak SQL or falsely acknowledge a save',async()=>{
  const f=fixture({serviceSupabaseClient:()=>({rpc:async()=>({error:{message:'secret-key SQL internal'},data:null})})});
  const r=await f.run(); assert.equal(r.status,503); assert.doesNotMatch(JSON.stringify(r),/secret-key|SQL internal/);
});
for (const data of [null, {status:'saved',workspaceId:'example-b',updatedAt:AFTER,fields:{}},
  {status:'saved',workspaceId:'example-a',updatedAt:BEFORE,fields:{recruiterName:'Example Recruiter'}},
  {status:'saved',workspaceId:'example-a',updatedAt:AFTER,fields:{recruiterName:'Other Value'}},
  {status:'saved',workspaceId:'example-a',updatedAt:AFTER,fields:{recruiterName:'Example Recruiter',tracker:[]}}]) {
  test(`rejects a mismatched database acknowledgement ${JSON.stringify(data)}`,async()=>{
    const f=fixture({serviceSupabaseClient:()=>({rpc:async()=>({data,error:null})})}); assert.equal((await f.run()).status,503);
  });
}
test('server output does not forward extra top-level database data',async()=>{
  const f=fixture({serviceSupabaseClient:()=>({rpc:async()=>({data:{status:'saved',workspaceId:'example-a',updatedAt:AFTER,
    fields:{recruiterName:'Example Recruiter'},tracker:[{private:'value'}],secret:'never-return'}})})});
  const r=await f.run(); assert.equal(r.status,200); assert.doesNotMatch(JSON.stringify(r.body),/tracker|never-return|private/);
});
test('RPC can deny a revocation that happened after the server authorization check',async()=>{
  let checked=false;
  const f=fixture({authorizedRecruiter:async()=>{checked=true;return {user:{id:USER},role:'recruiter',workspaceId:'example-a'};},
    serviceSupabaseClient:()=>({rpc:async()=>{assert.equal(checked,true);return {data:{status:'forbidden'}};}})});
  assert.equal((await f.run()).status,403);
});
test('unexpected exceptions produce sanitized unavailable responses',async()=>{
  const f=fixture({authorizedRecruiter:async()=>{throw new Error('private-token');}});
  const r=await f.run();assert.equal(r.status,503);assert.doesNotMatch(JSON.stringify(r),/private-token/);
});

test('staged SQL contract restricts function execution and does not grant browser table access (static only)',()=>{
  const sql=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261024000100_protected_workspace_setup.sql'),'utf8');
  assert.match(sql,/security invoker/i); assert.match(sql,/set search_path = ''/);
  assert.match(sql,/from public,anon,authenticated,service_role/); assert.match(sql,/to service_role/);
  assert.doesNotMatch(sql,/grant\s+(select|insert|update|all)\s/i); assert.doesNotMatch(sql,/create\s+policy/i);
  assert.ok(sql.indexOf('welcomeflow_workflow_members\n    where')<sql.indexOf('from public.welcomeflow_workspace_state'));
  assert.match(sql,/user_id = p_actor_id for share/); assert.match(sql,/for update/);
  assert.match(sql,/v_version is distinct from p_expected_updated_at/);
  for(const key of Object.keys(FIELDS)) assert.ok(sql.includes(`'${key}'`));
});
