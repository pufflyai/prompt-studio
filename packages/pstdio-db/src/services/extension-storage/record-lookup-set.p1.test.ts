import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import type { StorageRecordIndex } from "pstdio-sync-contracts";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

const indexes: StorageRecordIndex[] = [
  {
    name: "tasks",
    prefix: "task/",
    fields: {
      id: { path: ["id"], type: "string" },
      key: { path: ["key"], type: "string" },
      label: {
        type: "string",
        lookup: { index: "labels", on: [{ sourceField: "key", relatedField: "key", op: "eq" }], field: "label" },
      },
    },
    equality: ["id"],
    orderBy: [{ field: "label", direction: "asc" }],
  },
  {
    name: "labels",
    prefix: "label/",
    fields: { key: { path: ["key"], type: "string" }, label: { path: ["label"], type: "string" } },
    equality: ["key"],
    orderBy: [{ field: "label", direction: "asc" }],
  },
];

test("broad lookups preserve first-match order, encoded keys, nulls and fresh owner-scoped values", async () => {
  const f = await createExtensionStorageFixture();
  const owner = { workbenchId: f.projectAId, extensionId: "lookup-sets" };
  const store = createDocumentStorageDBService(f.db);
  try {
    await store.open({ owner: { ...owner, workbenchId: f.projectBId } }).records.commit({
      operationId: "other-owner",
      edits: [{ recordId: "label/00", replace: { key: "same", label: "Wrong owner" } }],
    });
    for (const records of [store.open({ owner }).records, createMemoryStorage(owner).records]) {
      await records.defineIndexes(indexes);
      await records.commit({
        operationId: "seed",
        edits: [
          { recordId: "task/a", replace: { id: "a", key: "same" } },
          { recordId: "task/nul", replace: { id: "nul", key: "x\0y" } },
          { recordId: "task/unicode", replace: { id: "unicode", key: "É/\ud800" } },
          { recordId: "task/null", replace: { id: "null", key: null } },
          { recordId: "task/missing", replace: { id: "missing" } },
          { recordId: "task/empty-first", replace: { id: "empty-first", key: "empty" } },
          { recordId: "task/invalid", replace: { id: "invalid", key: 42 } },
          { recordId: "label/10", replace: { key: "same", label: "First" } },
          { recordId: "label/2", replace: { key: "same", label: "Second" } },
          { recordId: "label/nul", replace: { key: "x\0y", label: "NUL" } },
          { recordId: "label/unicode", replace: { key: "É/\ud800", label: "Unicode" } },
          { recordId: "label/null", replace: { key: null, label: "Wrong null" } },
          { recordId: "label/empty1", replace: { key: "empty" } },
          { recordId: "label/empty2", replace: { key: "empty", label: "Wrong fallback" } },
          { recordId: "elsewhere/00", replace: { key: "same", label: "Wrong prefix" } },
        ],
      });
      expect((await records.aggregate({ index: "tasks", groupBy: "label", groupLimit: 10 })).groups).toEqual([
        { value: "First", count: 1 },
        { value: "NUL", count: 1 },
        { value: "Unicode", count: 1 },
        { value: null, count: 4 },
      ]);
      expect(
        (await records.aggregate({ index: "tasks", where: { field: "id", op: "eq", value: "a" }, groupBy: "label" }))
          .groups,
      ).toEqual([{ value: "First", count: 1 }]);
      const first = await records.query({ index: "tasks", fields: ["id", "label"], limit: 2 });
      expect(first.records.map(({ fields }) => fields)).toEqual([
        { id: "a", label: "First" },
        { id: "nul", label: "NUL" },
      ]);
      expect(
        (await records.query({ index: "tasks", fields: ["id", "label"], cursor: first.cursor!, limit: 2 })).records.map(
          ({ fields }) => fields.label,
        ),
      ).toEqual(["Unicode", null]);
      await records.commit({ operationId: "delete-first", edits: [{ recordId: "label/10", deleted: true }] });
      const updated = await records.aggregate({ index: "tasks", groupBy: "label", groupLimit: 10 });
      expect(updated.groups).toContainEqual({ value: "Second", count: 1 });
      expect(updated.groups.some(({ value }) => value === "First")).toBe(false);
    }
  } finally {
    await f.close();
  }
});
