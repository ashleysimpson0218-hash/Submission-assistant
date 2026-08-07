const mockRootRender = jest.fn();

jest.mock("react-dom/client", () => ({
  createRoot: jest.fn(() => ({ render: mockRootRender })),
}));
jest.mock("./reportWebVitals", () => jest.fn());
jest.mock("./App", () => {
  throw new Error("App.js must not initialize in maintenance mode");
});
jest.mock("@supabase/supabase-js", () => {
  throw new Error("Supabase must not initialize in maintenance mode");
});

test("maintenance entry path does not initialize App, Supabase, or local workspace storage", () => {
  const original = process.env.REACT_APP_MAINTENANCE_MODE;
  process.env.REACT_APP_MAINTENANCE_MODE = "true";
  document.body.innerHTML = '<div id="root"></div>';
  const storageRead = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("Local workspace storage must not be read in maintenance mode");
  });

  expect(() => require("./index")).not.toThrow();
  expect(mockRootRender).toHaveBeenCalledTimes(1);
  expect(mockRootRender.mock.calls[0][0].props.children.type.name).toBe("MaintenancePage");
  expect(storageRead).not.toHaveBeenCalled();

  storageRead.mockRestore();
  if (original === undefined) delete process.env.REACT_APP_MAINTENANCE_MODE;
  else process.env.REACT_APP_MAINTENANCE_MODE = original;
});
