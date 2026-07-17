const mockRootRender = jest.fn();

jest.mock("react-dom/client", () => ({
  createRoot: jest.fn(() => ({ render: mockRootRender })),
}));
jest.mock("./reportWebVitals", () => jest.fn());
jest.mock("./App", () => {
  throw new Error("App.js must not initialize with invalid configuration");
});
jest.mock("@supabase/supabase-js", () => {
  throw new Error("Supabase must not initialize with invalid configuration");
});

test("missing configuration renders the configuration gate without importing App", () => {
  const originalMaintenance = process.env.REACT_APP_MAINTENANCE_MODE;
  const originalEnvironment = process.env.REACT_APP_ENVIRONMENT;
  process.env.REACT_APP_MAINTENANCE_MODE = "false";
  delete process.env.REACT_APP_ENVIRONMENT;
  document.body.innerHTML = '<div id="root"></div>';

  expect(() => require("./index")).not.toThrow();
  expect(mockRootRender).toHaveBeenCalledTimes(1);
  expect(mockRootRender.mock.calls[0][0].props.children.type.name).toBe("ConfigurationErrorPage");

  if (originalMaintenance === undefined) delete process.env.REACT_APP_MAINTENANCE_MODE;
  else process.env.REACT_APP_MAINTENANCE_MODE = originalMaintenance;
  if (originalEnvironment === undefined) delete process.env.REACT_APP_ENVIRONMENT;
  else process.env.REACT_APP_ENVIRONMENT = originalEnvironment;
});
