const mockSecurity = { authenticatedUser: jest.fn(), consumePreAuthenticationRateLimit: jest.fn(), requestPayloadBytes: () => 0, readServerRuntimeConfig: jest.fn(), serviceSupabaseClient: () => ({}) };
const mockSnapshot = jest.fn(), mockCreate = jest.fn();
jest.mock('../server/welcomeflowApiSecurity', () => mockSecurity);
jest.mock('../server/workflow/store', () => ({ snapshot: mockSnapshot }));
jest.mock('../server/workflow/calendarConnection', () => ({ createConnectionService: mockCreate }));
const handler = require('../api/calendar');
const env = {...process.env};
let service;
beforeEach(() => {
  jest.clearAllMocks();process.env.VERCEL_ENV='preview';process.env.WELCOMEFLOW_MAINTENANCE_MODE='false';process.env.WELCOMEFLOW_API_WORKSPACE_IDS='test';process.env.WELCOMEFLOW_UAT_EXTERNAL_ACTIONS_DISABLED='false';
  mockSecurity.readServerRuntimeConfig.mockReturnValue({ok:true,environment:'preview',projectRef:'test-ref'});
  mockSecurity.consumePreAuthenticationRateLimit.mockResolvedValue({ok:true});
  mockSecurity.authenticatedUser.mockResolvedValue({user:{id:'trusted-user'}});
  mockSnapshot.mockResolvedValue({members:[{userId:'trusted-user',active:true}]});
  service={status:jest.fn().mockResolvedValue({connection:null,tests:[]}),authorize:jest.fn().mockResolvedValue({authorizationUrl:'https://connect.vercel.com/authorize/example'})};
  mockCreate.mockReturnValue(service);
});
afterAll(()=>{process.env=env;});
async function call(body){const res={setHeader:jest.fn(),end(x){this.body=JSON.parse(x);}};await handler({method:body?'POST':'GET',headers:{'x-welcomeflow-workspace-id':'test'},body},res);return res;}
test('production environment cannot invoke connector test',async()=>{process.env.VERCEL_ENV='production';expect((await call()).statusCode).toBe(503);expect(mockCreate).not.toHaveBeenCalled();});
test('production database runtime cannot invoke connector test',async()=>{mockSecurity.readServerRuntimeConfig.mockReturnValue({ok:true,environment:'production'});expect((await call()).statusCode).toBe(503);});
test('anonymous and inactive users cannot access calendar',async()=>{mockSecurity.authenticatedUser.mockResolvedValue({});expect((await call()).statusCode).toBe(401);mockSecurity.authenticatedUser.mockResolvedValue({user:{id:'trusted-user'}});mockSnapshot.mockResolvedValue({members:[{userId:'trusted-user',active:false}]});expect((await call()).statusCode).toBe(403);});
test('browser identity, connector and provider overrides are ignored',async()=>{expect((await call({action:'authorize',userId:'victim',connectorId:'other',workspaceId:'other'})).statusCode).toBe(200);expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({userId:'trusted-user',workspaceId:'test',projectRef:'test-ref'}));expect(service.authorize).toHaveBeenCalledWith();});
test('SDK errors cannot leak credentials or provider diagnostics',async()=>{service.authorize.mockRejectedValue(Object.assign(new Error('secret token value'), {status:400, code:'upstream_error'}));const r=await call({action:'authorize'});expect(r.statusCode).toBe(503);expect(JSON.stringify(r.body)).not.toContain('secret token');});

test('external-action safety switch blocks test appointment writes',async()=>{process.env.WELCOMEFLOW_UAT_EXTERNAL_ACTIONS_DISABLED='true';expect((await call({action:'book_test'})).statusCode).toBe(503);});
