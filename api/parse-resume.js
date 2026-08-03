const {
  authorizedRecruiter,
  consumeSharedRateLimit,
  requestPayloadBytes,
} = require("../server/welcomeflowApiSecurity");

if (process.env.WELCOMEFLOW_MAINTENANCE_MODE === "true" || process.env.WELCOMEFLOW_UAT_EXTERNAL_ACTIONS_DISABLED === "true") {
  module.exports = async function maintenanceHandler(req, res) {
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "WelcomeFlow is temporarily unavailable." }));
  };
} else {
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_REQUEST_BYTES = Math.ceil(MAX_UPLOAD_BYTES * 4 / 3) + 16 * 1024;
const MAX_ARCHIVE_ENTRIES = 500;
const MAX_ARCHIVE_ENTRY_BYTES = 16 * 1024 * 1024;
const MAX_ARCHIVE_TOTAL_BYTES = 32 * 1024 * 1024;
if (typeof global.DOMMatrix === "undefined") {
  global.DOMMatrix = class DOMMatrix {
    constructor() {
      this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
    }
    multiplySelf() { return this; }
    preMultiplySelf() { return this; }
    translateSelf() { return this; }
    scaleSelf() { return this; }
    rotateSelf() { return this; }
    invertSelf() { return this; }
  };
}
if (typeof global.Path2D === "undefined") global.Path2D = class Path2D {};
if (typeof global.ImageData === "undefined") {
  global.ImageData = class ImageData {
    constructor(data, width, height) {
      this.data = data;
      this.width = width;
      this.height = height;
    }
  };
}
const { PDFParse } = require("pdf-parse");
const path = require("path");
const zlib = require("zlib");
const { pathToFileURL } = require("url");

try {
  PDFParse.setWorker(pathToFileURL(path.join(path.dirname(require.resolve("pdf-parse")), "pdf.worker.mjs")).href);
} catch (error) {
  console.error("WelcomeFlow pdf-parse worker setup failed", error?.message || error);
}
let pdfjsLibraryPromise = null;

async function loadPdfJsLibrary() {
  if (!pdfjsLibraryPromise) {
    pdfjsLibraryPromise = import("pdfjs-dist/legacy/build/pdf.mjs").then((pdfjsLib) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(
        path.join(path.dirname(require.resolve("pdfjs-dist/legacy/build/pdf.mjs")), "pdf.worker.mjs"),
      ).href;
      return pdfjsLib;
    });
  }
  return pdfjsLibraryPromise;
}

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function flattenText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(flattenText).filter(Boolean).join("; ");
  if (typeof value === "object") {
    return value.name || value.value || value.text || value.label || value.raw || Object.values(value).map(flattenText).filter(Boolean).join(" ");
  }
  return String(value);
}

function list(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(flattenText).map((item) => item.trim()).filter(Boolean);
  const text = flattenText(value);
  return text ? [text] : [];
}

function formatParsedPhone(value = "") {
  const digits = String(value || "").replace(/\D/g, "");
  const ten = digits.length > 10 ? digits.slice(-10) : digits;
  if (ten.length !== 10) return String(value || "").trim();
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}

function compactSpacedLetters(value = "") {
  return String(value || "").replace(/\b(?:[A-Za-z]\s+){2,}[A-Za-z]\b/g, (match) => match.replace(/\s+/g, ""));
}

function leadingNameToken(line = "") {
  const compact = compactSpacedLetters(line).replace(/\s{2,}/g, " ").trim();
  const nonName = /support|healthcare|administrative|dministrative|admin|professional|profile|summary|objective|experience|education|skills|references|language|reception|operator|assistant|nurse|clerk|specialist|coordinator|manager|director|hospital|clinic|medical|resume|curriculum|vitae/i;
  if (!compact || nonName.test(compact.replace(/^[A-Za-z.'-]+\s*/, ""))) {
    const glued = compact.match(/^([A-Z]{3,})(?=[A-Z]\s+[A-Z]\s+[A-Z]|[A-Z]{2,}\s+(?:SUPPORT|NURSE|CLERK|ASSISTANT|ADMINISTRATIVE|HEALTHCARE|MEDICAL))/);
    if (glued) {
      const token = glued[1].length > 4 && glued[1].endsWith("A") ? glued[1].slice(0, -1) : glued[1];
      return token.replace(/\b\w/g, (char) => char.toUpperCase()).replace(/\B[A-Z]+/g, (part) => part.toLowerCase());
    }
  }
  if (/^[A-Za-z.'-]{2,}$/.test(compact) && !nonName.test(compact)) return compact.replace(/\b\w/g, (char) => char.toUpperCase()).replace(/\B[A-Z]+/g, (part) => part.toLowerCase());
  const twoWords = compact.match(/^([A-Z][A-Za-z.'-]+)\s+([A-Z][A-Za-z.'-]+)\b/);
  if (twoWords && !nonName.test(`${twoWords[1]} ${twoWords[2]}`)) return `${twoWords[1]} ${twoWords[2]}`;
  return "";
}


function xmlDecode(value = "") {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function stripXml(value = "") {
  return xmlDecode(String(value || "").replace(/<[^>]+>/g, " ")).replace(/\s{2,}/g, " ").trim();
}

function readZipEntries(buffer) {
  const source = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  let eocd = -1;
  for (let index = source.length - 22; index >= Math.max(0, source.length - 66000); index -= 1) {
    if (source.readUInt32LE(index) === 0x06054b50) {
      eocd = index;
      break;
    }
  }
  if (eocd < 0) throw new Error("ZIP directory was not found.");
  const totalEntries = source.readUInt16LE(eocd + 10);
  if (totalEntries > MAX_ARCHIVE_ENTRIES) throw new Error("Archive contains too many entries.");
  let offset = source.readUInt32LE(eocd + 16);
  const entries = new Map();
  let totalOutputBytes = 0;
  for (let item = 0; item < totalEntries; item += 1) {
    if (offset < 0 || offset + 46 > source.length) throw new Error("Archive directory is invalid.");
    if (source.readUInt32LE(offset) !== 0x02014b50) break;
    const method = source.readUInt16LE(offset + 10);
    const compressedSize = source.readUInt32LE(offset + 20);
    const nameLength = source.readUInt16LE(offset + 28);
    const extraLength = source.readUInt16LE(offset + 30);
    const commentLength = source.readUInt16LE(offset + 32);
    const localOffset = source.readUInt32LE(offset + 42);
    if (localOffset < 0 || localOffset + 30 > source.length) throw new Error("Archive entry is invalid.");
    const name = source.slice(offset + 46, offset + 46 + nameLength).toString("utf8");
    const localNameLength = source.readUInt16LE(localOffset + 26);
    const localExtraLength = source.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const raw = source.slice(dataStart, dataStart + compressedSize);
    let content = Buffer.alloc(0);
    if (method === 0) content = raw;
    else if (method === 8) content = zlib.inflateRawSync(raw, { maxOutputLength: MAX_ARCHIVE_ENTRY_BYTES });
    if (content.length > MAX_ARCHIVE_ENTRY_BYTES) throw new Error("Archive entry is too large.");
    totalOutputBytes += content.length;
    if (totalOutputBytes > MAX_ARCHIVE_TOTAL_BYTES) throw new Error("Archive expands beyond the safe processing limit.");
    if (content.length) entries.set(name, content);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function extractDocxTextServer(buffer) {
  const entries = readZipEntries(buffer);
  const documentNames = Array.from(entries.keys()).filter((name) => /^word\/(document|header\d+|footer\d+)\.xml$/i.test(name));
  const chunks = [];
  documentNames.forEach((name) => {
    const xml = entries.get(name).toString("utf8");
    const withBreaks = xml
      .replace(/<w:tab\b[^>]*\/>/g, "\t")
      .replace(/<w:br\b[^>]*\/>/g, "\n")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<\/w:tr>/g, "\n");
    const textRuns = Array.from(withBreaks.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)).map((match) => xmlDecode(match[1]));
    chunks.push(textRuns.join(" "));
  });
  return chunks.join("\n").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function extractXlsxTextServer(buffer) {
  const entries = readZipEntries(buffer);
  const sharedXml = entries.get("xl/sharedStrings.xml")?.toString("utf8") || "";
  const shared = Array.from(sharedXml.matchAll(/<si[\s\S]*?<\/si>/g)).map((match) => {
    const texts = Array.from(match[0].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)).map((textMatch) => xmlDecode(textMatch[1]));
    return texts.join("").trim();
  });
  const sheetNames = Array.from(entries.keys()).filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name)).sort();
  const rows = [];
  sheetNames.forEach((sheetName, sheetIndex) => {
    const xml = entries.get(sheetName).toString("utf8");
    rows.push(`Sheet ${sheetIndex + 1}`);
    Array.from(xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)).forEach((rowMatch) => {
      const cells = Array.from(rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)).map((cellMatch) => {
        const attrs = cellMatch[1] || "";
        const cellXml = cellMatch[2] || "";
        const inline = cellXml.match(/<t\b[^>]*>([\s\S]*?)<\/t>/)?.[1];
        if (inline) return xmlDecode(inline).trim();
        const raw = cellXml.match(/<v>([\s\S]*?)<\/v>/)?.[1] || "";
        if (/t=["']s["']/.test(attrs)) return shared[Number(raw)] || "";
        return stripXml(raw);
      }).filter((cell) => cell !== "");
      if (cells.length) rows.push(cells.join("\t"));
    });
  });
  return rows.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function extractRtfTextServer(buffer) {
  return buffer.toString("utf8")
    .replace(/\\'[0-9a-fA-F]{2}/g, " ")
    .replace(/\\par[d]?/g, "\n")
    .replace(/\\[a-zA-Z]+-?\d* ?/g, " ")
    .replace(/[{}]/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractPlainOrLegacyTextServer(buffer) {
  // The NUL match is intentional: resume extraction must not retain embedded NULs.
  // eslint-disable-next-line no-control-regex
  const utf8 = buffer.toString("utf8").replace(/\u0000/g, " ");
  const readable = utf8.match(/[\x20-\x7E\n\r\t]{4,}/g)?.join(" ") || utf8;
  return readable.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
function extractLocalResumeFields(text = "", filename = "") {
  const raw = String(text || "").split(String.fromCharCode(0)).join(" ").trim();
  const normalized = compactSpacedLetters(raw);
  const lines = raw.split(/\r?\n/).map((line) => compactSpacedLetters(line).replace(/\s{2,}/g, " ").trim()).filter(Boolean);
  const nonName = /support|healthcare|administrative|admin|professional|profile|summary|objective|experience|education|skills|references|language|reception|operator|assistant|nurse|clerk|specialist|coordinator|manager|director|hospital|clinic|medical|resume|curriculum|vitae/i;
  const explicitName = raw.match(/(?:name|candidate)[:-]\s*([^\n|]+)/i)?.[1]?.trim() || "";
  let name = explicitName;
  if (!name) {
    const first = lines.slice(0, 6).map(leadingNameToken).find((token) => token && !nonName.test(token));
    const firstIndex = first ? lines.findIndex((line) => leadingNameToken(line) === first) : -1;
    const last = firstIndex >= 0 ? lines.slice(firstIndex + 1, firstIndex + 5).map(leadingNameToken).find((token) => token && !nonName.test(token) && token.toLowerCase() !== first.toLowerCase()) : "";
    if (first && last) name = `${first} ${last}`;
  }
  if (!name) {
    const fullNameLine = lines.slice(0, 8).find((line) => /^[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3}$/i.test(line) && !nonName.test(line));
    if (fullNameLine) name = fullNameLine;
  }
  if (!name && filename) {
    const fromFile = String(filename).replace(/\.[^.]+$/, "").replace(/resume|pdf|docx?|rtf/gi, " ").replace(/[_-]+/g, " ").replace(/\s{2,}/g, " ").trim();
    if (/^[A-Za-z.'-]+(?:\s+[A-Za-z.'-]+){1,3}$/.test(fromFile)) name = fromFile;
  }
  name = name.replace(/\b\w/g, (char) => char.toUpperCase()).replace(/\B[A-Z]+/g, (part) => part.toLowerCase()).trim();
  const email = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  const phoneMatch = raw.match(/(?:\+?\s*)?\(?\d{3}\)?[-.\s]*\d{3}[-.\s]*\d{4}/) || raw.match(/(?:phone|cell|mobile)[:-]\s*([^\n|]+)/i);
  const phone = formatParsedPhone(phoneMatch?.[1] || phoneMatch?.[0] || "");
  const rolePatterns = [
    ["Registered Nurse (RN)", /registered nurse|\brn\b/i],
    ["Licensed Practical Nurse (LPN)", /licensed practical nurse|\blpn\b/i],
    ["Certified Nursing Assistant", /certified nursing assistant|\bcna\b/i],
    ["Certified Medical Assistant (CMA)", /certified medical assistant|\bcma\b/i],
    ["Administrative / Healthcare Support", /administrative\s*\/?\s*healthcare support|healthcare support|medical office administration|reception|switchboard/i],
    ["Administrative Support", /administrative support|office assistant|receptionist|central station operator/i],
  ];
  const currentTitle = raw.match(/(?:role|position|position applied for|applied position|applying for|desired position|job title)[:-]\s*([^\n|]+)/i)?.[1]?.trim()
    || rolePatterns.find(([, regex]) => regex.test(normalized))?.[0]
    || "";
  const certifications = [
    /registered nurse|\brn\b/i.test(normalized) ? "RN" : "",
    /licensed practical nurse|\blpn\b/i.test(normalized) ? "LPN" : "",
    /certified nursing assistant|\bcna\b/i.test(normalized) ? "CNA" : "",
    /cpr|bls/i.test(normalized) ? "CPR/BLS" : "",
    /acls/i.test(normalized) ? "ACLS" : "",
  ].filter(Boolean);
  const education = [];
  if (/master|msn|mba|m\.s\.|\bma\b/i.test(normalized)) education.push("Master's");
  else if (/bachelor|bsn|b\.s\.|\bba\b/i.test(normalized)) education.push("Bachelor's");
  else if (/associate|asn|a\.s\./i.test(normalized)) education.push("Associate's");
  else if (/some college/i.test(normalized)) education.push("Some college");
  else if (/high school|ged|diploma/i.test(normalized)) education.push("High School / GED");
  const location = lines.slice(0, 14).find((line) => /\d+\s+[A-Za-z0-9 .'-]+\b(?:rd|road|st|street|dr|drive|ln|lane|ave|avenue|blvd|hwy|highway)\b/i.test(line))
    || lines.find((line) => /\b[A-Z][A-Za-z .'-]+,\s*[A-Z]{2}\b(?:\s+\d{5})?/i.test(line))
    || "";
  const skillsIndex = lines.findIndex((line) => /^skills|core skills|technical skills|competencies/i.test(line));
  const experienceIndex = lines.findIndex((line) => /^experience|work\s*experience|workexperience|employment|professional experience|work history/i.test(line));
  const skills = skillsIndex >= 0 ? lines.slice(skillsIndex + 1, skillsIndex + 8).filter((line) => !/^references|languages/i.test(line)).slice(0, 12) : [];
  let workHistory = experienceIndex >= 0 ? lines.slice(experienceIndex + 1, experienceIndex + 12).filter((line) => !/^education|skills/i.test(line)).slice(0, 8) : [];
  const dateLineIndexes = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => /\b(?:jan|feb|mar|apr|may|jun|jul|july|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{4}\s*[-–]\s*(?:present|current|now|(?:jan|feb|mar|apr|may|jun|jul|july|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{4})/i.test(line));
  if (dateLineIndexes.length) {
    const firstDateIndex = dateLineIndexes[0].index;
    const titlePool = lines.slice(Math.max(0, firstDateIndex - (dateLineIndexes.length + 4)), firstDateIndex)
      .filter((entry) => /^[A-Za-z][A-Za-z /&'-]{3,}$/.test(entry) && !/profile|summary|work|experience|education|skills/i.test(entry))
      .slice(-dateLineIndexes.length);
    const employerPool = lines.slice(dateLineIndexes[dateLineIndexes.length - 1].index + 1, dateLineIndexes[dateLineIndexes.length - 1].index + 1 + dateLineIndexes.length + 4)
      .filter((entry) => /\||hospital|clinic|company|center|health|regional|medical|com\s/i.test(entry))
      .slice(0, dateLineIndexes.length);
    const datedWorkHistory = dateLineIndexes.map(({ line, index }) => {
      const sequenceIndex = dateLineIndexes.findIndex((dateItem) => dateItem.index === index);
      const title = titlePool[sequenceIndex] || lines.slice(Math.max(0, index - 3), index).reverse().find((entry) => /^[A-Za-z][A-Za-z /&'-]{3,}$/.test(entry) && !nonName.test(entry.replace(/receptionist|operator|assistant|coordinator|manager|specialist/ig, ""))) || lines[index - 1] || "";
      const employer = employerPool[sequenceIndex] || lines.slice(index + 1, index + 4).find((entry) => /\||hospital|clinic|company|center|health|regional|medical|com\s/i.test(entry)) || "";
      return [title, line, employer].filter(Boolean).join(" | ");
    }).filter(Boolean).slice(0, 6);
    if (datedWorkHistory.length) workHistory = datedWorkHistory;
  }
  const found = [name, email, phone, currentTitle, education.length, certifications.length, skills.length, workHistory.length].filter(Boolean).length;
  return {
    name,
    email,
    phone,
    location,
    currentTitle,
    summary: lines.filter((line) => !/@/.test(line)).slice(0, 8).join(" ").slice(0, 600),
    yearsExperience: raw.match(/(\d+(?:\.\d+)?)\s*(?:\+?\s*)?(?:years|yrs)/i)?.[1] || "",
    education,
    certifications,
    skills,
    workHistory,
    confidence: Math.round((found / 8) * 100),
    warnings: [
      name ? "" : "Candidate name was not confidently found.",
      email || phone ? "" : "No email or phone was found.",
      currentTitle ? "" : "Position/title was not confidently found.",
    ].filter(Boolean),
  };
}

function normalizeAffinda(payload = {}) {
  const data = payload.data || payload.document?.data || payload;
  const name = flattenText(data.name || data.candidateName || data.fullName);
  const emails = list(data.emails || data.email);
  const phones = list(data.phoneNumbers || data.phones || data.phone);
  const location = flattenText(data.location || data.address || data.city);
  const workHistory = list(data.workExperience || data.workHistory || data.experience).slice(0, 8);
  const education = list(data.education || data.educationHistory).slice(0, 6);
  const certifications = list(data.certifications || data.licenses || data.license || data.accreditations).slice(0, 10);
  const skills = list(data.skills || data.skill || data.professionalSkills).slice(0, 24);
  const currentTitle = flattenText(data.profession || data.currentJobTitle || data.jobTitle || data.objective);
  const summary = flattenText(data.summary || data.objective || data.sections?.summary);
  const totalYears = data.totalYearsExperience || data.yearsExperience || data.yearsOfExperience || "";
  const text = [
    name ? `Name: ${name}` : "",
    emails[0] ? `Email: ${emails[0]}` : "",
    phones[0] ? `Phone: ${phones[0]}` : "",
    location ? `Location: ${location}` : "",
    currentTitle ? `Current Title: ${currentTitle}` : "",
    summary ? `Summary: ${summary}` : "",
    totalYears ? `Experience: ${totalYears}` : "",
    education.length ? `Education: ${education.join("; ")}` : "",
    certifications.length ? `Certifications: ${certifications.join("; ")}` : "",
    skills.length ? `Skills: ${skills.join("; ")}` : "",
    workHistory.length ? `Work History: ${workHistory.join("; ")}` : "",
  ].filter(Boolean).join("\n");
  const found = [name, emails[0], phones[0], currentTitle, education.length, certifications.length, skills.length, workHistory.length].filter(Boolean).length;
  return {
    text,
    fields: {
      name,
      email: emails[0] || "",
      phone: phones[0] || "",
      location,
      currentTitle,
      summary,
      yearsExperience: totalYears ? `${totalYears}` : "",
      education,
      certifications,
      skills,
      workHistory,
    },
    confidence: Math.round((found / 8) * 100),
    warnings: found < 3 ? ["Parser returned limited fields. Review the resume manually before saving."] : [],
  };
}

async function extractPdfTextServer(buffer) {
  try {
    const parser = new PDFParse({ data: buffer, isEvalSupported: false });
    const result = await parser.getText();
    await parser.destroy?.();
    const parsed = String(result?.text || "").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    if (parsed) return parsed;
  } catch (error) {
    console.error("WelcomeFlow pdf-parse extraction failed", error?.message || error);
    // Fall through to PDF.js below.
  }
  try {
    const pdfjsLib = await loadPdfJsLibrary();
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      disableWorker: true,
      isEvalSupported: false,
      useSystemFonts: true,
    });
    const pdf = await loadingTask.promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const positioned = (content.items || [])
        .map((item) => ({
          text: String(item.str || "").trim(),
          x: Number(item.transform?.[4] || 0),
          y: Number(item.transform?.[5] || 0),
        }))
        .filter((item) => item.text);
      positioned.sort((a, b) => Math.abs(b.y - a.y) > 4 ? b.y - a.y : a.x - b.x);
      const lines = [];
      positioned.forEach((item) => {
        const last = lines[lines.length - 1];
        if (!last || Math.abs(last.y - item.y) > 4) lines.push({ y: item.y, text: item.text });
        else last.text = `${last.text} ${item.text}`.replace(/\s{2,}/g, " ");
      });
      const text = lines.map((line) => line.text).join("\n");
      if (text.trim()) pages.push(text.trim());
    }
    return pages.join("\n").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  } catch (error) {
    console.error("WelcomeFlow pdfjs extraction failed", error?.message || error);
    return "";
  }
}

async function parseWithWelcomeFlowLocal({ buffer, filename, mimeType }) {
  const file = String(filename || "").toLowerCase();
  const type = String(mimeType || "").toLowerCase();
  let text = "";
  let sourceLabel = "document";
  if (/\.pdf$/i.test(file) || /pdf/i.test(type)) {
    text = await extractPdfTextServer(buffer);
    sourceLabel = "PDF text layer";
  } else if (/\.docx$/i.test(file) || /officedocument\.wordprocessingml/i.test(type)) {
    text = extractDocxTextServer(buffer);
    sourceLabel = "Word document";
  } else if (/\.xlsx$/i.test(file) || /officedocument\.spreadsheetml/i.test(type)) {
    text = extractXlsxTextServer(buffer);
    sourceLabel = "Excel workbook";
  } else if (/\.rtf$/i.test(file) || /rtf/i.test(type)) {
    text = extractRtfTextServer(buffer);
    sourceLabel = "RTF document";
  } else if (/\.txt$|\.csv$|\.tsv$|\.json$|\.xml$/i.test(file) || /^text\//i.test(type)) {
    text = extractPlainOrLegacyTextServer(buffer);
    sourceLabel = "text file";
  } else if (/\.doc$|\.xls$/i.test(file)) {
    text = extractPlainOrLegacyTextServer(buffer);
    sourceLabel = "legacy Microsoft file best-effort text";
  }
  if (!text) return { ok: false, status: 422, error: "No readable document text found. OCR or a resume parser provider is needed for this file.", provider: "WelcomeFlow Local Parser" };
  const localFields = extractLocalResumeFields(text, filename);
  return {
    ok: true,
    provider: "WelcomeFlow Local Parser",
    text,
    fields: localFields,
    confidence: localFields.confidence || 50,
    warnings: [`Parsed from ${sourceLabel}. Review extracted fields before saving.`, ...(localFields.warnings || [])],
  };
}

async function parseWithAffinda({ buffer, filename, mimeType }) {
  const apiKey = process.env.AFFINDA_API_KEY;
  if (!apiKey) {
    return parseWithWelcomeFlowLocal({ buffer, filename, mimeType });
  }

  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mimeType || "application/octet-stream" }), filename || "resume.pdf");
  if (process.env.AFFINDA_WORKSPACE) form.append("workspace", process.env.AFFINDA_WORKSPACE);
  if (process.env.AFFINDA_COLLECTION) form.append("collection", process.env.AFFINDA_COLLECTION);
  form.append("wait", "true");

  const response = await fetch("https://api.affinda.com/v3/documents", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { ok: false, status: response.status >= 400 && response.status < 500 ? 422 : 502, error: "The resume parser provider could not complete this request.", provider: "Affinda" };
  }
  const normalized = normalizeAffinda(payload);
  return { ok: true, provider: "Affinda", ...normalized };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });
  try {
    if (requestPayloadBytes(req) > MAX_REQUEST_BYTES) return json(res, 413, { ok: false, error: "Resume file is too large for parsing. Maximum is 8MB." });

    const authorization = await authorizedRecruiter(req);
    if (!authorization.user) {
      return json(res, authorization.unavailable ? 503 : authorization.forbidden ? 403 : 401, { ok: false, error: authorization.error });
    }

    const rateLimit = await consumeSharedRateLimit({
      action: "parse-resume",
      subject: `user:${authorization.user.id}`,
      limit: process.env.WELCOMEFLOW_RESUME_RATE_LIMIT_PER_MINUTE || 6,
      windowSeconds: 60,
    });
    if (rateLimit.unavailable) return json(res, 503, { ok: false, error: rateLimit.error });
    if (!rateLimit.ok) return json(res, 429, { ok: false, error: "Too many resume parsing requests. Try again shortly." });

    const { filename = "resume", mimeType = "application/octet-stream", size = 0, base64 = "" } = req.body || {};
    if (!base64) return json(res, 400, { ok: false, error: "Missing resume file payload" });
    if (typeof base64 !== "string" || base64.length > Math.ceil(MAX_UPLOAD_BYTES * 4 / 3) + 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
      return json(res, 413, { ok: false, error: "Resume file is too large or invalid for parsing. Maximum is 8MB." });
    }

    const buffer = Buffer.from(base64, "base64");
    if (buffer.length > MAX_UPLOAD_BYTES || (Number(size || 0) > 0 && Number(size) !== buffer.length)) {
      return json(res, 413, { ok: false, error: "Resume file size validation failed." });
    }
    const provider = String(process.env.RESUME_PARSER_PROVIDER || "affinda").toLowerCase();
    const result = provider === "affinda"
      ? await parseWithAffinda({ buffer, filename, mimeType })
      : provider === "local"
        ? await parseWithWelcomeFlowLocal({ buffer, filename, mimeType })
      : { ok: false, status: 501, error: `Resume parser provider '${provider}' is not supported yet.`, provider };

    return json(res, result.ok ? 200 : result.status || 502, result);
  } catch (error) {
    console.error("WelcomeFlow resume parsing failed", { code: error?.code || "", provider: process.env.RESUME_PARSER_PROVIDER || "adapter" });
    return json(res, 500, { ok: false, error: "Resume parsing could not be completed safely.", provider: process.env.RESUME_PARSER_PROVIDER || "adapter" });
  }
};
}


