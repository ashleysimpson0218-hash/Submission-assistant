import {
  readSavedIntakeDraftIdentity,
  savedDraftArray,
} from "./intakeDraftCompatibility";

test("missing saved intake identity fields render as safe empty values", () => {
  expect(readSavedIntakeDraftIdentity({})).toEqual({
    fullName: "",
    emailAddress: "",
    normalizedName: "",
    normalizedEmail: "",
    phoneDigits: "",
  });
});

test("empty saved intake full name remains empty", () => {
  expect(readSavedIntakeDraftIdentity({ fullName: "" }).fullName).toBe("");
});

test("valid saved intake identity fields are normalized only for rendering and matching", () => {
  expect(readSavedIntakeDraftIdentity({
    fullName: "  Synthetic Candidate 001  ",
    emailAddress: "  SYNTHETIC001@EXAMPLE.TEST ",
    phoneNumber: "(555) 010-0101",
  })).toEqual({
    fullName: "Synthetic Candidate 001",
    emailAddress: "SYNTHETIC001@EXAMPLE.TEST",
    normalizedName: "synthetic candidate 001",
    normalizedEmail: "synthetic001@example.test",
    phoneDigits: "5550100101",
  });
});

test("optional array fields render safely when absent", () => {
  expect(savedDraftArray(undefined)).toEqual([]);
  const warnings = ["Synthetic warning"];
  expect(savedDraftArray(warnings)).toBe(warnings);
});

test("reading an incomplete saved draft does not mutate the stored object", () => {
  const storedDraft = {
    emailAddress: "  synthetic@example.test ",
    phoneNumber: undefined,
    nested: { preserved: true },
  };
  const before = {
    ...storedDraft,
    nested: { ...storedDraft.nested },
  };

  readSavedIntakeDraftIdentity(storedDraft);
  savedDraftArray(storedDraft.extractionWarnings);

  expect(storedDraft).toEqual(before);
  expect(Object.prototype.hasOwnProperty.call(storedDraft, "fullName")).toBe(false);
  expect(Object.prototype.hasOwnProperty.call(storedDraft, "extractionWarnings")).toBe(false);
});
