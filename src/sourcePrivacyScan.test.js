import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

const repoRoot = path.resolve(__dirname, "..");
const textExtensions = new Set([".js", ".jsx", ".json", ".md", ".sql", ".txt", ".yml", ".yaml", ".html", ".css"]);
const scanFile = path.basename(__filename);

function trackedTextFiles() {
  return execFileSync("git", ["ls-files"], { cwd: repoRoot, encoding: "utf8" })
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((file) => path.basename(file) !== scanFile)
    .filter((file) => path.basename(file) !== "package-lock.json")
    .filter((file) => fs.existsSync(path.join(repoRoot, file)))
    .filter((file) => textExtensions.has(path.extname(file).toLowerCase()));
}

test("tracked source contains no personal WelcomeFlow identities or non-reserved email defaults", () => {
  const prohibitedValues = [
    "pretty girl wave",
    "ashley martin",
    "ashleysimpson0218",
    "770-318-8742",
    "chelsea warthen",
    "talitha quarterman",
    "nittaya everheart",
  ];
  const emailPattern = /[a-z0-9._%+-]+@([a-z0-9.-]+\.[a-z]{2,})/gi;
  const failures = [];

  trackedTextFiles().forEach((file) => {
    const content = fs.readFileSync(path.join(repoRoot, file), "utf8");
    const lower = content.toLowerCase();
    prohibitedValues.forEach((value) => {
      if (lower.includes(value)) failures.push(`${file}: prohibited identity ${value}`);
    });
    for (const match of content.matchAll(emailPattern)) {
      const domain = String(match[1] || "").toLowerCase();
      if (!["example.com", "example.test", "test.example", "unapproved.invalid"].includes(domain)) {
        failures.push(`${file}: non-reserved email domain ${domain}`);
      }
    }
  });

  expect(failures).toEqual([]);
});
