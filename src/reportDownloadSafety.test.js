const fs = require("fs");
const path = require("path");

const appSource = fs.readFileSync(path.join(__dirname, "App.js"), "utf8");

test("report downloads use a mobile-safe attached link with delayed cleanup", () => {
  expect(appSource).toMatch(/document\.body\.appendChild\(anchor\)/);
  expect(appSource).toMatch(/window\.setTimeout\(\(\) => \{\s*anchor\.remove\(\);\s*URL\.revokeObjectURL\(url\);\s*\}, 3000\)/);
  expect(appSource).toMatch(/isSpreadsheet \? \["\\ufeff", content \|\| ""\]/);
});

test("facility workbook export creates one browser download", () => {
  const exportBody = appSource.match(/function exportFacilityWorkbooks\(\) \{([\s\S]*?)\r?\n {2}\}\r?\n\r?\n {2}function saveReportsToHistory/)?.[1] || "";
  expect(exportBody).toMatch(/const sheets = rows\.flatMap/);
  expect(exportBody.match(/downloadExcelWorkbook\(/g)).toHaveLength(1);
  expect(exportBody).toMatch(/downloaded in one Excel file/);
});

test("Excel workbook downloads use genuine SpreadsheetML worksheets and trusted formulas", () => {
  expect(appSource).toMatch(/<Workbook xmlns=/);
  expect(appSource).toMatch(/<Worksheet ss:Name=/);
  expect(appSource).toMatch(/ss:Formula=/);
  expect(appSource).toMatch(/<AutoFilter x:Range=/);
});

test("Weekly Cleanup builder receives only date-filtered and non-excluded report rows", () => {
  const builderTag = appSource.match(/<WeeklyCleanupReportBuilder[\s\S]*?\/>/)?.[0] || "";
  expect(builderTag).toMatch(/tracker=\{includedReportRows\}/);
  expect(builderTag).toMatch(/history=\{history\}/);
  expect(builderTag).not.toMatch(/tracker=\{safeTrackerRows\}/);
});

test("Excel workbook serialization allocates unique sanitized worksheet names", () => {
  expect(appSource).toMatch(/uniqueExcelSheetNames\(safeSheets\.map\(\(sheet\) => sheet\.name\)\)/);
  expect(appSource).toMatch(/uniqueSheetNames\[sheetIndex\]/);
});
