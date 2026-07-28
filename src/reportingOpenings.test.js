import { openingsForReq } from "./App";

test("preserves explicit zero openings for canonical no-opening decisions", () => {
  expect(openingsForReq({ numberOfOpenings: 0 })).toBe(0);
  expect(openingsForReq({ openings: "0" })).toBe(0);
});

test("uses positive openings and a backward-compatible default only when the field is absent", () => {
  expect(openingsForReq({ numberOfOpenings: 3 })).toBe(3);
  expect(openingsForReq({})).toBe(1);
  expect(openingsForReq({ numberOfOpenings: "unknown" })).toBe(1);
});
