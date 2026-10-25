import { expect, test } from "bun:test";
import { createRow } from "./fixture";
import { editOperation } from "./operations";

test("each operation changes the intended value and supplies an exact fixture restore", () => {
  const base = createRow("rich", 0, 37, 3);
  for (const operation of [
    "short",
    "indexed",
    "tag",
    "nested",
    "multiline",
    "insert",
    "delete",
    "direct-sdk-first-write",
  ]) {
    const edit = editOperation("rich", operation, "run-a", 10_000);
    expect(edit.restore.rows).toEqual(operation === "insert" ? [] : [base]);
    expect(edit.expected).not.toEqual(base);
    expect(edit.restore.restore).toBe(operation === "delete");
  }
  expect(editOperation("small", "indexed", "one", 100_000).expected?.ordinal).toBe(38);
  expect(editOperation("small", "insert", "one", 100_000).recordId).not.toBe(
    editOperation("small", "insert", "two", 100_000).recordId,
  );
});
