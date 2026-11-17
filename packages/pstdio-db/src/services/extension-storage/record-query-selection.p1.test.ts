import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import type { Json, StorageRecordIndex } from "pstdio-sync-contracts";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

test("selection queries resolve legacy choices and concurrent scalar/map edits before filtering", async () => {
  const f = await createExtensionStorageFixture();
  try {
    const owner = { workbenchId: f.projectAId, extensionId: "ext.example" };
    const definition: StorageRecordIndex = {
      name: "choices",
      fields: {
        selected: {
          path: ["legacy"],
          type: "array",
          derive: { kind: "selection", selectionPath: ["delta"], knownValues: ["a", "b", "c"] },
        },
        first: {
          path: ["legacy"],
          type: "string",
          derive: { kind: "selection", selectionPath: ["delta"], knownValues: ["a", "b", "c"] },
        },
      },
    };
    const cases: (Record<string, Json> & { expected: string[] })[] = [
      { legacy: ["b", "a"], expected: ["b", "a"] },
      {
        legacy: ["a"],
        delta: { type: "single", value: "b", options: { a: true, c: true }, replacedOptions: { a: true } },
        expected: ["b", "c"],
      },
      {
        legacy: ["a", "b"],
        delta: { type: "multi", options: { a: false, c: true }, value: "d", replacedValue: "b" },
        expected: ["b", "c"],
      },
      { legacy: ["b"], delta: { type: "multi", options: { b: false }, value: "b", replacedValue: "b" }, expected: [] },
      {
        legacy: ["a"],
        delta: { type: "single", value: null, options: { a: true }, replacedOptions: { a: true } },
        expected: [],
      },
    ];
    const db = createDocumentStorageDBService(f.db).open({ owner }).records;
    for (const records of [db, createMemoryStorage(owner).records]) {
      await records.commit({
        operationId: "seed",
        edits: cases.map(({ expected, ...value }, i) => ({ recordId: String(i), replace: value })),
      });
      await records.defineIndexes([definition]);
      const all = await records.query({ index: "choices" });
      expect(all.records.map((row) => row.fields.selected)).toEqual(cases.map((entry) => entry.expected));
      expect(all.records.map((row) => row.fields.first)).toEqual(cases.map((entry) => entry.expected[0] ?? null));
      const selected = await records.query({
        index: "choices",
        where: { field: "selected", op: "contains", value: "c" },
        limit: 1,
      });
      expect(selected.records[0].recordId).toBe("1");
      expect(
        (await records.aggregate({ index: "choices", where: { field: "selected", op: "contains", value: "c" } })).count,
      ).toBe(2);
      await records.commit({ operationId: "remove", edits: [{ recordId: "1", set: { "/delta/options/c": false } }] });
      expect(
        (await records.aggregate({ index: "choices", where: { field: "selected", op: "contains", value: "c" } })).count,
      ).toBe(1);
    }
    const reopened = createDocumentStorageDBService(f.db).open({ owner }).records;
    expect(
      (
        await reopened.query({ index: "choices", where: { field: "selected", op: "contains", value: "c" } })
      ).records.map((row) => row.recordId),
    ).toEqual(["2"]);
  } finally {
    await f.close();
  }
});
