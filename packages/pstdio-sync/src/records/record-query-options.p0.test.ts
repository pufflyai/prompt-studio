import { expect, test } from "bun:test";
import type { StorageComputedField, StorageExpression } from "pstdio-sync-contracts";
import { validateRelatedQueryFields } from "./record-query-options";

test("computed expression work is bounded across cases and related indexes", () => {
  const expression: StorageExpression = { op: "and", args: Array.from({ length: 64 }, () => ({ literal: true })) };
  const field: StorageComputedField = {
    type: "boolean",
    cases: Array.from({ length: 8 }, () => ({ when: { test: expression }, value: true })),
  };
  const computed = { a: field };
  expect(() => validateRelatedQueryFields({ index: "root", computed })).not.toThrow();
  expect(() => validateRelatedQueryFields({ index: "root", computed, related: { other: { computed } } })).toThrow(
    "too large",
  );
});
