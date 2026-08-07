import fs from "fs";
import path from "path";

const appSource = fs.readFileSync(path.resolve(__dirname, "App.js"), "utf8");
const browserSecuritySource = fs.readFileSync(path.resolve(__dirname, "resumePdfSecurity.js"), "utf8");
const apiSource = fs.readFileSync(path.resolve(__dirname, "../api/parse-resume.js"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../package.json"), "utf8"));

describe("PDF resume parsing safety", () => {
  test("pins a PDF.js release that contains the GHSA-wgrm-67xf-hhpq patch", () => {
    expect(packageJson.dependencies["pdfjs-dist"]).toBe("4.2.67");
  });

  test("disables PDF.js evaluation in the browser parser", () => {
    expect(appSource).toContain('pdfjs-dist/legacy/build/pdf.mjs');
    expect(appSource).toContain('browserPdfJsPromise = import("pdfjs-dist/legacy/build/pdf.mjs")');
    expect(browserSecuritySource).toMatch(/pdfjsLib\.getDocument\(\{\s*data,\s*isEvalSupported: false\s*}\)/);
  });

  test("disables evaluation in both server PDF parser paths", () => {
    expect(apiSource).toContain('import("pdfjs-dist/legacy/build/pdf.mjs")');
    expect(apiSource).toMatch(/new PDFParse\(\{ data: buffer, isEvalSupported: false }\)/);
    expect(apiSource).toMatch(/pdfjsLib\.getDocument\(\{[\s\S]*?isEvalSupported: false/);
  });
});
