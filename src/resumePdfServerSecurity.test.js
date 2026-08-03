const { maxPdfPages: MAX_PDF_PAGES } = require("./resumeSecurityLimits.json");
const PDF_PAGE_LIMIT_ERROR_CODE = "RESUME_PDF_PAGE_LIMIT";

describe("server PDF page limits", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env.WELCOMEFLOW_MAINTENANCE_MODE = "false";
    process.env.WELCOMEFLOW_UAT_EXTERNAL_ACTIONS_DISABLED = "false";
  });

  afterAll(() => { process.env = originalEnv; });

  function loadApi(total, text = "Synthetic resume") {
    const getInfo = jest.fn(async () => ({ total }));
    const getText = jest.fn(async () => ({ text }));
    const destroy = jest.fn(async () => {});
    jest.doMock("pdf-parse", () => ({
      PDFParse: class PDFParse {
        static setWorker() {}
        getInfo = getInfo;
        getText = getText;
        destroy = destroy;
      },
    }));
    const handler = require("../api/parse-resume");
    return { api: handler.__test, getText, destroy };
  }

  test("primary parser rejects an over-limit document before text extraction", async () => {
    const { api, getText, destroy } = loadApi(MAX_PDF_PAGES + 1);
    await expect(api.extractPdfTextServer(Buffer.from("%PDF-1.7"))).rejects.toMatchObject({ code: PDF_PAGE_LIMIT_ERROR_CODE });
    expect(getText).not.toHaveBeenCalled();
    expect(destroy).toHaveBeenCalled();
  });

  test("primary parser accepts a document exactly at the limit", async () => {
    const { api, getText } = loadApi(MAX_PDF_PAGES);
    await expect(api.extractPdfTextServer(Buffer.from("%PDF-1.7"))).resolves.toBe("Synthetic resume");
    expect(getText).toHaveBeenCalledWith({ first: MAX_PDF_PAGES });
  });

  test("PDF.js fallback rejects before reading a page", async () => {
    const { api } = loadApi(1);
    const getPage = jest.fn();
    const pdfjsLib = { getDocument: jest.fn(() => ({ promise: Promise.resolve({ numPages: MAX_PDF_PAGES + 1, getPage }) })) };
    await expect(api.extractPdfTextWithPdfJs(pdfjsLib, Buffer.from("%PDF-1.7"))).rejects.toMatchObject({ code: PDF_PAGE_LIMIT_ERROR_CODE });
    expect(getPage).not.toHaveBeenCalled();
  });
});
