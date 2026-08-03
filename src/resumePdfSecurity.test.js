import {
  MAX_PDF_PAGES,
  PDF_INVALID_ERROR_CODE,
  PDF_PAGE_LIMIT_ERROR_CODE,
  assertPdfPageCount,
  extractBrowserPdfText,
} from "./resumePdfSecurity";

function browserPdf(pageCount) {
  const getPage = jest.fn(async (pageNumber) => ({
    getTextContent: jest.fn(async () => ({ items: [{ str: `Page ${pageNumber}` }] })),
  }));
  const pdfjsLib = {
    getDocument: jest.fn(() => ({ promise: Promise.resolve({ numPages: pageCount, getPage }) })),
  };
  return { pdfjsLib, getPage };
}

describe("resume PDF page limits", () => {
  test.each([0, -1, Number.NaN, "2"])("rejects an invalid page count %p", (pageCount) => {
    expect(() => assertPdfPageCount(pageCount)).toThrow(expect.objectContaining({ code: PDF_INVALID_ERROR_CODE }));
  });

  test.each([MAX_PDF_PAGES - 1, MAX_PDF_PAGES])("accepts a bounded page count %p", (pageCount) => {
    expect(assertPdfPageCount(pageCount)).toBe(pageCount);
  });

  test.each([MAX_PDF_PAGES + 1, Number.MAX_SAFE_INTEGER])("rejects an excessive page count %p", (pageCount) => {
    expect(() => assertPdfPageCount(pageCount)).toThrow(expect.objectContaining({ code: PDF_PAGE_LIMIT_ERROR_CODE }));
  });

  test("browser extraction validates the count before reading any page", async () => {
    const { pdfjsLib, getPage } = browserPdf(MAX_PDF_PAGES + 1);
    await expect(extractBrowserPdfText(pdfjsLib, new ArrayBuffer(8))).rejects.toMatchObject({ code: PDF_PAGE_LIMIT_ERROR_CODE });
    expect(getPage).not.toHaveBeenCalled();
  });

  test("browser extraction reads a document exactly at the limit", async () => {
    const { pdfjsLib, getPage } = browserPdf(MAX_PDF_PAGES);
    await expect(extractBrowserPdfText(pdfjsLib, new ArrayBuffer(8))).resolves.toContain("Page 1");
    expect(getPage).toHaveBeenCalledTimes(MAX_PDF_PAGES);
  });
});
