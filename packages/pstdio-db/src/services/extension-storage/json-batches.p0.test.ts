import { expect, test } from "bun:test";
import { jsonBatches } from "./json-batches";

test("batches split by encoded bytes, keep row order, and give an oversized row its own batch", () => {
  // 1.5 MB of three-byte characters per row: three rows exceed 4 MB in bytes but not in characters.
  const wide = "€".repeat(500_000);
  const rows = [{ id: 1, wide }, { id: 2, wide }, { id: 3, wide }, { id: 4, huge: "x".repeat(5_000_000) }, { id: 5 }];

  const batches = jsonBatches(rows).map((batch) => JSON.parse(batch) as { id: number }[]);

  expect(batches.map((batch) => batch.map(({ id }) => id))).toEqual([[1, 2], [3], [4], [5]]);
  expect(jsonBatches([])).toEqual([]);
});
