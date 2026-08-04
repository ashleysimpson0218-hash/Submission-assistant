const mockRootRender = jest.fn();

jest.mock("react-dom/client", () => ({
  createRoot: jest.fn(() => ({ render: mockRootRender })),
}));
jest.mock("./reportWebVitals", () => jest.fn());
jest.mock("./App", () => {
  throw new Error("App.js must not initialize in production maintenance mode");
});
jest.mock("@supabase/supabase-js", () => {
  throw new Error("Supabase must not initialize in production maintenance mode");
});

const PRODUCTION_PROJECT_REF = "qfpgednixvveelgwfylv";
const ENVIRONMENT_KEYS = [
  "REACT_APP_ENVIRONMENT",
  "REACT_APP_SUPABASE_URL",
  "REACT_APP_SUPABASE_ANON_KEY",
  "REACT_APP_ALLOWED_SUPABASE_PROJECT_REF",
  "REACT_APP_MAINTENANCE_MODE",
];

describe("production entry gate", () => {
  const originalEnvironment = Object.fromEntries(ENVIRONMENT_KEYS.map((key) => [key, process.env[key]]));

  beforeEach(() => {
    jest.resetModules();
    mockRootRender.mockClear();
    window.localStorage.clear();
    process.env.REACT_APP_ENVIRONMENT = "production";
    process.env.REACT_APP_SUPABASE_URL = `https://${PRODUCTION_PROJECT_REF}.supabase.co`;
    process.env.REACT_APP_SUPABASE_ANON_KEY = "public-production-key";
    process.env.REACT_APP_ALLOWED_SUPABASE_PROJECT_REF = PRODUCTION_PROJECT_REF;
    document.body.innerHTML = '<div id="root"></div>';
  });

  afterAll(() => {
    ENVIRONMENT_KEYS.forEach((key) => {
      if (originalEnvironment[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnvironment[key];
    });
  });

  test.each([undefined, "false", "invalid"])("does not initialize App when maintenance is %p", (maintenanceValue) => {
    if (maintenanceValue === undefined) delete process.env.REACT_APP_MAINTENANCE_MODE;
    else process.env.REACT_APP_MAINTENANCE_MODE = maintenanceValue;
    window.localStorage.setItem("welcomeflow-session", "active");
    window.localStorage.setItem("welcomeflow-role", "admin");

    expect(() => require("./index")).not.toThrow();
    expect(mockRootRender).toHaveBeenCalledTimes(1);
    expect(mockRootRender.mock.calls[0][0].props.children.type.name).toBe("MaintenancePage");
  });
});
