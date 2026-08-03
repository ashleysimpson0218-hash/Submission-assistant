const { validateResumeFile } = require("../server/resumeFileValidation");

function zipFixture(folder) {
  return Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    Buffer.from(`[Content_Types].xml\0${folder}/document.xml`, "utf8"),
  ]);
}

test.each([
  ["resume.pdf", "application/pdf", Buffer.from("%PDF-1.7\nsynthetic")],
  ["resume.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", zipFixture("word")],
  ["resume.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", zipFixture("xl")],
  ["resume.doc", "application/msword", Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])],
  ["resume.rtf", "application/rtf", Buffer.from("{\\rtf1 synthetic}")],
  ["resume.txt", "text/plain", Buffer.from("Synthetic Candidate")],
])("accepts matching extension, MIME, and signature for %s", (filename, mimeType, buffer) => {
  expect(validateResumeFile({ filename, mimeType, buffer })).toMatchObject({ ok: true });
});

test("rejects renamed executable content", () => {
  expect(validateResumeFile({ filename: "resume.pdf", mimeType: "application/pdf", buffer: Buffer.from("MZ executable") })).toMatchObject({
    ok: false,
    code: "RESUME_FILE_SIGNATURE_INVALID",
  });
});

test("rejects mismatched MIME claims and unsupported extensions", () => {
  expect(validateResumeFile({ filename: "resume.pdf", mimeType: "text/plain", buffer: Buffer.from("%PDF-1.7") }).code).toBe("RESUME_FILE_TYPE_MISMATCH");
  expect(validateResumeFile({ filename: "resume.exe", mimeType: "application/octet-stream", buffer: Buffer.from("MZ") }).code).toBe("RESUME_FILE_EXTENSION_UNSUPPORTED");
});

test("rejects binary data disguised as text", () => {
  expect(validateResumeFile({ filename: "resume.txt", mimeType: "text/plain", buffer: Buffer.from([0x41, 0, 0x42]) }).ok).toBe(false);
});
