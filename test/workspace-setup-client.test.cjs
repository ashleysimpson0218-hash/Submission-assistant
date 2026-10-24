const test=require('node:test');
const assert=require('node:assert/strict');
const {createWorkspaceSetupClient,acknowledgesCurrentSetupEdit}=require('../src/workspaceSetupClient');
const BEFORE='2026-10-24T10:00:00.000001+00:00', AFTER='2026-10-24T10:00:00.000002+00:00';
const args={expectedUpdatedAt:BEFORE,changes:{companyName:'Example Company'},editRevision:3};
function setup({getAccessToken=async()=> 'example-token',fetchImpl}={}){
  const calls=[];
  const fetcher=fetchImpl||(async (url,init)=>{
    calls.push({url,init});
    const fields=init.body?JSON.parse(init.body).changes:{companyName:'Example Company'};
    return {ok:true,status:200,json:async()=>({ok:true,workspaceId:'example-a',updatedAt:init.body?AFTER:BEFORE,fields})};
  });
  return {client:createWorkspaceSetupClient({workspaceId:'example-a',getAccessToken,fetchImpl:fetcher}),calls};
}
test('adapter sends tokens only to the fixed same-origin endpoint with no cache or redirects',async()=>{
  const {client,calls}=setup();const r=await client.save(args);assert.equal(r.ok,true);
  assert.equal(calls[0].url,'/api/workspace-setup');assert.equal(calls[0].init.cache,'no-store');
  assert.equal(calls[0].init.redirect,'error');assert.equal(calls[0].init.credentials,'omit');
  assert.equal(calls[0].init.headers['X-WelcomeFlow-Workspace-Id'],'example-a');
  assert.equal(calls[0].init.headers.Authorization,'Bearer example-token');
  assert.deepEqual(JSON.parse(calls[0].init.body),{expectedUpdatedAt:BEFORE,changes:args.changes});
});
test('read returns exact version for later compare-and-save',async()=>{
  const {client,calls}=setup();const r=await client.load();assert.equal(r.updatedAt,BEFORE);assert.equal(calls[0].init.method,'GET');
  assert.equal(calls[0].init.body,undefined);assert.equal(r.savedEditRevision,undefined);
});
test('missing token prevents request, with no local-storage fallback',async()=>{
  const {client,calls}=setup({getAccessToken:async()=>null});const r=await client.load();assert.equal(r.code,'AUTH_REQUIRED');assert.equal(calls.length,0);
});
test('token is obtained afresh per request, not retained by adapter',async()=>{
  let n=0;const {client,calls}=setup({getAccessToken:async()=>`test-token-${++n}`});await client.load();await client.save(args);
  assert.equal(calls[0].init.headers.Authorization,'Bearer test-token-1');assert.equal(calls[1].init.headers.Authorization,'Bearer test-token-2');
});
for(const [status,code] of [[401,'AUTH_REQUIRED'],[403,'FORBIDDEN'],[409,'CONFLICT'],[400,'INVALID_REQUEST'],[503,'UNAVAILABLE']]){
  test(`HTTP ${status} is not saved and never automatically retried`,async()=>{
    let calls=0;const {client}=setup({fetchImpl:async()=>{calls++;return {ok:false,status,json:async()=>({error:'private-provider-detail'})};}});
    const r=await client.save(args);assert.equal(calls,1);assert.equal(r.code,code);assert.equal(r.savedEditRevision,undefined);
    assert.doesNotMatch(JSON.stringify(r),/private-provider/);
  });
}
test('network failure is an unknown result, not success or a blind retry',async()=>{
  let calls=0;const {client}=setup({fetchImpl:async()=>{calls++;throw new Error('private detail');}});
  assert.equal((await client.save(args)).code,'UNAVAILABLE');assert.equal(calls,1);
});
test('invalid local fields and revisions do not reach the server',async()=>{
  const {client,calls}=setup();
  for(const bad of [{...args,changes:{tracker:[]}},{...args,changes:{}},{...args,editRevision:-1},{...args,editRevision:1.5},{...args,expectedUpdatedAt:'yesterday'}]) {
    assert.equal((await client.save(bad)).code,'INVALID_REQUEST');
  }
  assert.equal(calls.length,0);
});
for(const patch of [{workspaceId:'example-b'},{updatedAt:BEFORE},{fields:{companyName:'wrong'}},{fields:{companyName:'Example Company',secret:'no'}}]){
  test(`unmatched server acknowledgement is not success ${JSON.stringify(patch)}`,async()=>{
    const {client}=setup({fetchImpl:async()=>({ok:true,json:async()=>({ok:true,workspaceId:'example-a',updatedAt:AFTER,fields:args.changes,...patch})})});
    assert.equal((await client.save(args)).ok,false);
  });
}
test('an older save is acknowledged only for its submitted edit and workspace',async()=>{
  const {client}=setup();const r=await client.save(args);
  assert.equal(acknowledgesCurrentSetupEdit(r,{workspaceId:'example-a',editRevision:3}),true);
  assert.equal(acknowledgesCurrentSetupEdit(r,{workspaceId:'example-a',editRevision:4}),false);
  assert.equal(acknowledgesCurrentSetupEdit(r,{workspaceId:'example-b',editRevision:3}),false);
});
test('typing while authentication resolves cannot change the submitted snapshot',async()=>{
  let resume;const token=new Promise(resolve=>{resume=resolve;});const {client,calls}=setup({getAccessToken:()=>token});
  const changes={companyName:'Original edit'};const pending=client.save({...args,changes,editRevision:2});
  changes.companyName='New edit';resume('token');const r=await pending;
  assert.equal(JSON.parse(calls[0].init.body).changes.companyName,'Original edit');
  assert.equal(r.fields.companyName,'Original edit');assert.equal(r.savedEditRevision,2);
});
test('requires an explicit valid workspace and a token provider',()=>{
  assert.throws(()=>createWorkspaceSetupClient());
  assert.throws(()=>createWorkspaceSetupClient({workspaceId:'../company-b',getAccessToken:async()=>''}));
});

test('load and malformed results never acknowledge an unspecified edit',async()=>{
  const {client}=setup();const loaded=await client.load();
  assert.equal(acknowledgesCurrentSetupEdit(loaded,{workspaceId:'example-a'}),false);
  assert.equal(acknowledgesCurrentSetupEdit({ok:true,workspaceId:'example-a'},{workspaceId:'example-a'}),false);
});

test('disposal during token acquisition prevents the request',async()=>{
  let resolveToken;const token=new Promise(resolve=>{resolveToken=resolve;});
  const {client,calls}=setup({getAccessToken:()=>token});const pending=client.load();
  client.dispose();resolveToken('token');
  assert.equal((await pending).code,'AUTH_REQUIRED');assert.equal(calls.length,0);
  assert.equal((await client.save(args)).code,'AUTH_REQUIRED');assert.equal(calls.length,0);
});
test('disposal hides a pending response after logout or workspace switch',async()=>{
  let resolveJson;const data=new Promise(resolve=>{resolveJson=resolve;});
  const {client}=setup({fetchImpl:async()=>({ok:true,json:()=>data})});
  const pending=client.save(args);await new Promise(resolve=>setImmediate(resolve));client.dispose();
  resolveJson({ok:true,workspaceId:'example-a',updatedAt:AFTER,fields:args.changes});
  const result=await pending;assert.equal(result.code,'AUTH_REQUIRED');assert.equal(result.fields,undefined);
  assert.equal(acknowledgesCurrentSetupEdit(result,{workspaceId:'example-a',editRevision:3}),false);
});
