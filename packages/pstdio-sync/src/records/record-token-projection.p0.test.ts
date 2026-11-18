import { expect, test } from "bun:test";
import type { StorageIndexField } from "pstdio-sync-contracts";
import { typedFieldValue, validateQueryField } from "./record-query-field";

test("token projections preserve strict legacy reference parsing without reading documents at query time", () => {
  const field = {
    path: ["reason"],
    type: "array",
    derive: {
      kind: "tokens",
      pattern: "^Complete (.+) before implementing this dependent contract\\.$",
      split: ",\\s*(?:and\\s+)?|\\s+and\\s+",
      itemPattern: "^[A-Z][A-Z0-9]*-\\d+$",
      trim: true,
    },
  } as unknown as StorageIndexField;
  expect(() => validateQueryField("refs", field)).not.toThrow();
  expect(
    typedFieldValue({ reason: " Complete PS-1, PS-2 and PS-3 before implementing this dependent contract. " }, field),
  ).toEqual(["PS-1", "PS-2", "PS-3"]);
  expect(
    typedFieldValue({ reason: "Complete PS-1 and other work before implementing this dependent contract." }, field),
  ).toBeUndefined();
  expect(typedFieldValue({ reason: "Independent blocker PS-1" }, field)).toBeUndefined();
});
