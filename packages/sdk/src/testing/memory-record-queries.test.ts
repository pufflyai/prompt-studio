import { expect, test } from "bun:test";
import type { StoragePredicate, StorageRecordIndex } from "pstdio-api-contracts/extension-kernel";
import { createMemoryStorage } from "./memory-storage";

const definitions: StorageRecordIndex[] = [
  {
    name: "values",
    fields: {
      text: { path: ["text"], type: "string" },
      rank: { path: ["nested", "rank"], type: "number" },
      tags: { path: ["tags"], type: "array" },
      active: { path: ["active"], type: "boolean" },
    },
    orderBy: [{ field: "rank", direction: "desc" }],
  },
];

test("memory queries support typed predicates, selected fields, aggregates and stable pages", async () => {
  const { records } = createMemoryStorage({ indexes: definitions });
  await records.commit({
    operationId: "seed",
    edits: [
      { recordId: "a", replace: { text: "Percent%_", nested: { rank: 2 }, tags: ["one", "two"], active: true } },
      { recordId: "b", replace: { text: null, nested: { rank: 2 }, tags: [], active: false } },
      { recordId: "c", replace: { nested: { rank: 1 } } },
      { recordId: "d", replace: { text: "Other", tags: ["two"], active: true } },
    ],
  });
  const first = await records.query({ index: "values", limit: 2, fields: ["text"] });
  expect(first.records.map((record) => record.recordId)).toEqual(["a", "b"]);
  expect(first.records.map((record) => record.fields)).toEqual([{ text: "Percent%_" }, { text: null }]);
  const second = await records.query({ index: "values", limit: 2, fields: ["text"], cursor: first.cursor! });
  expect(second.records.map((record) => record.recordId)).toEqual(["c", "d"]);
  expect(second.cursor).toBeNull();
  const cases: [StoragePredicate, string[]][] = [
    [{ field: "text", op: "eq", value: null }, ["b", "c"]],
    [{ field: "text", op: "missing" }, ["c"]],
    [{ field: "tags", op: "empty" }, ["b", "c"]],
    [{ field: "tags", op: "contains", value: "two" }, ["a", "d"]],
    [{ field: "text", op: "contains", value: "%_" }, ["a"]],
    [{ field: "text", op: "contains", value: "PERcent" }, ["a"]],
    [{ field: "active", op: "in", value: [true] }, ["a", "d"]],
    [
      {
        all: [
          { field: "active", op: "eq", value: true },
          { field: "rank", op: "gte", value: 2 },
        ],
      },
      ["a"],
    ],
    [{ field: "rank", op: "gt", value: null }, []],
  ];
  for (const [where, ids] of cases)
    expect((await records.query({ index: "values", where })).records.map((record) => record.recordId)).toEqual(ids);
  expect((await records.aggregate({ index: "values", groupBy: "active" })).groups).toEqual([
    { value: false, count: 1 },
    { value: true, count: 2 },
    { value: null, count: 1 },
  ]);
  expect((await records.readMany(["a", "unknown", "a"])).map((record) => record.exists)).toEqual([true, false, true]);
  await expect(records.query({ index: "values", limit: 101 })).rejects.toThrow("100");
  await expect(records.query({ index: "values", where: { field: "rank", op: "eq", value: "2" } })).rejects.toThrow(
    "number",
  );
  await expect(records.query({ index: "values", fields: ["unknown"] })).rejects.toThrow("Unknown");
  await records.commit({ operationId: "change", edits: [{ recordId: "c", replace: { nested: { rank: 3 } } }] });
  await expect(records.query({ index: "values", fields: ["text"], cursor: first.cursor! })).rejects.toThrow("stale");
});
