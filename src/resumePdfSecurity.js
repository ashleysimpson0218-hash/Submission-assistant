import resumeSecurityLimits from "./resumeSecurityLimits.json";

export const MAX_PDF_PAGES = resumeSecurityLimits.maxPdfPages;
export const PDF_PAGE_LIMIT_ERROR_CODE = "RESUME_PDF_PAGE_LIMIT";
export const PDF_INVALID_ERROR_CODE = "RESUME_PDF_INVALID";

export function pdfPageCountError(pageCount) {
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    const error = new Error("The PDF document is malformed or contains no pages.");
    error.code = PDF_INVALID_ERROR_CODE;
    return error;
  }
  if (pageCount > MAX_PDF_PAGES) {
    const error = new Error(`The PDF exceeds the ${MAX_PDF_PAGES}-page processing limit.`);
    error.code = PDF_PAGE_LIMIT_ERROR_CODE;
    return error;
  }
  return null;
}

export function assertPdfPageCount(pageCount) {
  const error = pdfPageCountError(pageCount);
  if (error) throw error;
  return pageCount;
}

export async function extractBrowserPdfText(pdfjsLib, data) {
  const loadingTask = pdfjsLib.getDocument({ data, isEvalSupported: false });
  const pdf = await loadingTask.promise;
  assertPdfPageCount(pdf.numPages);
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push((content.items || []).map((item) => item.str).join(" "));
  }
  return pages.join("\n").trim();
}
