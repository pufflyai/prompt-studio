import { expect, test } from "bun:test";
import { createDocumentStorage, createMemoryDocumentStore } from "pstdio-sync";
import type { Json, StoragePredicate } from "pstdio-sync-contracts";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

test("scalar text predicates preserve public page and aggregate semantics", async () => {
  const f = await createExtensionStorageFixture();
  try {
    const owner = { workbenchId: f.projectAId, extensionId: "ext.example" };
    const database = createDocumentStorageDBService(f.db).open({ owner }).records;
    const memory = createDocumentStorage({ owner, store: createMemoryDocumentStore() }).records;
    const values: Json[] = [
      { n: 112, text: "ÉİẞΣ", active: true },
      { n: 1e23, text: "A\u0000B", active: false },
      { n: 1e-7, text: "A😀", active: null },
      { n: -0, text: "𐐀" },
      { n: null, text: null },
      {},
      { n: "112", text: 112 },
    ];
    const cases: [StoragePredicate, string[]][] = [
      [{ field: "n", op: "textContains", value: "12" }, ["0"]],
      [{ field: "n", op: "textContains", value: "E+23" }, ["1"]],
      [{ field: "n", op: "textContains", value: "e-7" }, ["2"]],
      [{ field: "n", op: "textContains", value: "0" }, ["3"]],
      [{ field: "n", op: "textContains", value: "" }, ["0", "1", "2", "3"]],
      [{ field: "n", op: "textContains", value: "\u0000" }, []],
      [{ field: "text", op: "textContains", value: "éi\u0307ßς" }, ["0"]],
      [{ field: "text", op: "textContains", value: "\u0000b" }, ["1"]],
      [{ field: "text", op: "textContains", value: "\ud83d" }, ["2"]],
      [{ field: "text", op: "textContains", value: "𐐨" }, ["3"]],
      [{ field: "active", op: "textContains", value: "RU" }, ["0"]],
      [{ field: "active", op: "textContains", value: "ALS" }, ["1"]],
      [{ not: { field: "n", op: "textContains", value: "" } }, ["4", "5", "6"]],
    ];
    for (const records of [database, memory]) {
      await records.defineIndexes([
        {
          name: "scalars",
          fields: {
            n: { path: ["n"], type: "number" },
            text: { path: ["text"], type: "string" },
            active: { path: ["active"], type: "boolean" },
            tags: { path: ["tags"], type: "array" },
          },
        },
      ]);
      await records.commit({
        operationId: "scalars",
        edits: values.map((replace, index) => ({ recordId: String(index), replace })),
      });
      for (const [where, ids] of cases) {
        const page = await records.query({ index: "scalars", where, fields: ["n"] });
        const aggregate = await records.aggregate({ index: "scalars", where });
        expect(page.records.map((row) => row.recordId)).toEqual(ids);
        expect(aggregate.count).toBe(ids.length);
        expect(aggregate.revision).toBe(page.revision);
      }
      await expect(
        records.query({ index: "scalars", where: { field: "tags", op: "textContains", value: "a" } }),
      ).rejects.toThrow("scalar");
      await expect(
        records.query({ index: "scalars", where: { field: "n", op: "textContains", value: 12 } }),
      ).rejects.toThrow("string");
    }
  } finally {
    await f.close();
  }
});
