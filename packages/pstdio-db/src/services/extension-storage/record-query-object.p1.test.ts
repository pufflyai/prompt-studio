import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import type { StorageRecordIndex } from "pstdio-sync-contracts";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

test("indexed object key selection matches memory and filters before paging", async () => {
  const fixture = await createExtensionStorageFixture();
  try {
    const host = createDocumentStorageDBService(fixture.db).open({
      owner: { workbenchId: fixture.projectAId, extensionId: "ext.example" },
    }).records;
    const memory = createMemoryStorage().records;
    const definition: StorageRecordIndex = {
      name: "properties",
      fields: { choices: { path: ["choices"], type: "object" } },
    };
    for (const records of [host, memory]) {
      await records.defineIndexes([definition]);
      await records.commit({
        operationId: "seed",
        edits: [
          { recordId: "a", replace: { choices: { other: true } } },
          { recordId: "b", replace: { choices: { "selected\u0000😀": false } } },
          { recordId: "c", replace: { choices: "selected\u0000😀" } },
          { recordId: "d", replace: { choices: { "selected\u0000😀": ["one", "two"] } } },
          { recordId: "e", replace: { choices: ["selected\u0000😀"] } },
        ],
      });
      const where = { field: "choices", op: "hasKey" as const, value: "selected\u0000😀" };
      const first = await records.query({ index: "properties", where, fields: [], limit: 1 });
      expect(first.records.map(({ recordId }) => recordId)).toEqual(["b"]);
      const last = await records.query({ index: "properties", where, fields: [], limit: 1, cursor: first.cursor! });
      expect(last.records.map(({ recordId }) => recordId)).toEqual(["d"]);
      expect((await records.aggregate({ index: "properties", where })).count).toBe(2);
      await expect(
        records.query({ index: "properties", where: { field: "choices", op: "hasKey", value: 1 } }),
      ).rejects.toThrow();
    }
  } finally {
    await fixture.close();
  }
});
