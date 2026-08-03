const path = require("path");

const GENERIC_MIME_TYPES = new Set(["", "application/octet-stream", "binary/octet-stream"]);
const TYPE_RULES = {
  ".pdf": { kind: "pdf", mime: ["application/pdf"] },
  ".docx": { kind: "docx", mime: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip"] },
  ".xlsx": { kind: "xlsx", mime: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/zip"] },
  ".doc": { kind: "ole", mime: ["application/msword", "application/x-ole-storage"] },
  ".xls": { kind: "ole", mime: ["application/vnd.ms-excel", "application/x-ole-storage"] },
  ".rtf": { kind: "rtf", mime: ["application/rtf", "text/rtf"] },
  ".txt": { kind: "text", mime: ["text/plain"] },
  ".text": { kind: "text", mime: ["text/plain"] },
  ".csv": { kind: "text", mime: ["text/csv", "application/csv", "text/plain"] },
  ".tsv": { kind: "text", mime: ["text/tab-separated-values", "text/plain"] },
};

function hasPrefix(buffer, bytes) {
  return bytes.every((value, index) => buffer[index] === value);
}

function zipContains(buffer, name) {
  return buffer.includes(Buffer.from(name, "utf8"));
}

function validSignature(buffer, kind) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return false;
  if (kind === "pdf") return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  if (kind === "docx" || kind === "xlsx") {
    const zip = hasPrefix(buffer, [0x50, 0x4b, 0x03, 0x04]) || hasPrefix(buffer, [0x50, 0x4b, 0x05, 0x06]);
    return zip && zipContains(buffer, "[Content_Types].xml") && zipContains(buffer, kind === "docx" ? "word/" : "xl/");
  }
  if (kind === "ole") return hasPrefix(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  if (kind === "rtf") return buffer.subarray(0, 5).toString("ascii").toLowerCase() === "{\\rtf";
  if (kind === "text") {
    if (buffer.includes(0)) return false;
    const decoded = buffer.toString("utf8");
    const replacements = (decoded.match(/\uFFFD/g) || []).length;
    return decoded.trim().length > 0 && replacements <= Math.max(1, Math.floor(decoded.length * 0.01));
  }
  return false;
}

function validateResumeFile({ buffer, filename, mimeType }) {
  const extension = path.extname(String(filename || "").trim()).toLowerCase();
  const rule = TYPE_RULES[extension];
  if (!rule) {
    return { ok: false, code: "RESUME_FILE_EXTENSION_UNSUPPORTED", error: "This resume file type is not supported." };
  }

  const claimedMime = String(mimeType || "").trim().toLowerCase().split(";")[0];
  if (!GENERIC_MIME_TYPES.has(claimedMime) && !rule.mime.includes(claimedMime)) {
    return { ok: false, code: "RESUME_FILE_TYPE_MISMATCH", error: "The resume filename and content type do not match." };
  }
  if (!validSignature(buffer, rule.kind)) {
    return { ok: false, code: "RESUME_FILE_SIGNATURE_INVALID", error: "The resume file content does not match its filename." };
  }
  return { ok: true, kind: rule.kind, extension, mimeType: claimedMime || "application/octet-stream" };
}

module.exports = { TYPE_RULES, validateResumeFile, validSignature };
