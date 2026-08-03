const zlib = require("zlib");

function zipBuffer(entrySpecs = []) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  entrySpecs.forEach((spec) => {
    const name = Buffer.from(spec.name, "utf8");
    const content = Buffer.isBuffer(spec.content) ? spec.content : Buffer.from(spec.content || "", "utf8");
    const method = spec.method ?? 0;
    const raw = spec.raw || (method === 8 ? zlib.deflateRawSync(content) : content);
    const compressedSize = spec.compressedSize ?? raw.length;
    const uncompressedSize = spec.uncompressedSize ?? content.length;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(spec.flags || 0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(compressedSize, 18);
    local.writeUInt32LE(uncompressedSize, 22);
    local.writeUInt16LE(name.length, 26);
    localParts.push(local, name, raw);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(spec.flags || 0, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(compressedSize, 20);
    central.writeUInt32LE(uncompressedSize, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(localOffset, 42);
    centralParts.push(central, name);
    localOffset += local.length + name.length + raw.length;
  });

  const centralDirectory = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entrySpecs.length, 8);
  eocd.writeUInt16LE(entrySpecs.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(localOffset, 16);
  return Buffer.concat([...localParts, centralDirectory, eocd]);
}

describe("resume archive compression security", () => {
  let readZipEntries;
  let validateArchiveEntryMetadata;

  beforeAll(() => {
    ({ readZipEntries, validateArchiveEntryMetadata } = require("../api/parse-resume").__test);
  });

  test.each([
    ["DOCX", [
      { name: "[Content_Types].xml", content: "<Types/>" },
      { name: "word/document.xml", content: "<w:document><w:t>Synthetic resume</w:t></w:document>", method: 8 },
    ]],
    ["XLSX", [
      { name: "[Content_Types].xml", content: "<Types/>" },
      { name: "xl/worksheets/sheet1.xml", content: "<worksheet><row><c><v>1</v></c></row></worksheet>", method: 8 },
    ]],
  ])("accepts a normal %s archive", (label, entries) => {
    expect(Array.from(readZipEntries(zipBuffer(entries)).keys())).toEqual(entries.map((entry) => entry.name));
  });

  test("accepts the exact per-entry compression-ratio boundary", () => {
    expect(validateArchiveEntryMetadata({
      compressedSize: 10,
      uncompressedSize: 1000,
      method: 8,
      totalCompressedBytes: 1000,
      totalUncompressedBytes: 1000,
    })).toEqual({ totalCompressedBytes: 1010, totalUncompressedBytes: 2000 });
  });

  test("rejects one entry above the compression-ratio limit before inflation", () => {
    const inflateSpy = jest.spyOn(zlib, "inflateRawSync");
    expect(() => readZipEntries(zipBuffer([{
      name: "word/document.xml",
      raw: Buffer.alloc(10, 1),
      method: 8,
      compressedSize: 10,
      uncompressedSize: 1001,
    }]))).toThrow(expect.objectContaining({ code: "RESUME_ARCHIVE_UNSAFE" }));
    expect(inflateSpy).not.toHaveBeenCalled();
    inflateSpy.mockRestore();
  });

  test("rejects a cumulative compression ratio above the limit", () => {
    expect(() => validateArchiveEntryMetadata({
      compressedSize: 1,
      uncompressedSize: 81,
      method: 8,
      totalCompressedBytes: 9,
      totalUncompressedBytes: 720,
    })).toThrow(expect.objectContaining({ code: "RESUME_ARCHIVE_UNSAFE" }));
  });

  test("rejects zero compressed size with nonzero declared output", () => {
    expect(() => validateArchiveEntryMetadata({
      compressedSize: 0,
      uncompressedSize: 1,
      method: 8,
    })).toThrow(expect.objectContaining({ code: "RESUME_ARCHIVE_UNSAFE" }));
  });

  test("rejects misreported sizes instead of reading into the central directory", () => {
    expect(() => readZipEntries(zipBuffer([{
      name: "word/document.xml",
      content: "small",
      compressedSize: 20,
      uncompressedSize: 20,
    }]))).toThrow(expect.objectContaining({ code: "RESUME_ARCHIVE_UNSAFE" }));
  });

  test("rejects excessive declared uncompressed output", () => {
    expect(() => validateArchiveEntryMetadata({
      compressedSize: 1024 * 1024,
      uncompressedSize: (16 * 1024 * 1024) + 1,
      method: 8,
    })).toThrow(expect.objectContaining({ code: "RESUME_ARCHIVE_UNSAFE" }));
  });

  test.each(["../outside.xml", "nested/archive.zip"])("rejects unsafe archive member %s", (name) => {
    expect(() => readZipEntries(zipBuffer([{ name, content: "unsafe" }]))).toThrow(expect.objectContaining({ code: "RESUME_ARCHIVE_UNSAFE" }));
  });
});
