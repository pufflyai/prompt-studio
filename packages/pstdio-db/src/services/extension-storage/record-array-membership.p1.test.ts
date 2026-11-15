import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import type { StoragePredicate } from "pstdio-sync-contracts";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

test("large array controls retain all/any/none semantics with duplicates, missing values and encoded Unicode", async () => {
  const fixture = await createExtensionStorageFixture();
  try {
    const native = createDocumentStorageDBService(fixture.db).open({
      owner: { workbenchId: fixture.projectAId, extensionId: "array-controls" },
    }).records;
    const values = [...Array.from({ length: 203 }, (_, i) => `tag-${i}`), "é", "\ud800", "\0"];
    for (const records of [native, createMemoryStorage().records]) {
      await records.defineIndexes([{ name: "tags", fields: { tags: { path: ["tags"], type: "array" } } }]);
      await records.commit({
        operationId: "seed",
        edits: [
          { recordId: "all", replace: { tags: values } },
          { recordId: "duplicates", replace: { tags: [values[0], values[0]] } },
          { recordId: "other", replace: { tags: ["other"] } },
          { recordId: "empty", replace: { tags: [] } },
          { recordId: "missing", replace: {} },
          { recordId: "null", replace: { tags: null } },
        ],
      });
      for (const [op, ids] of [
        ["containsAll", ["all"]],
        ["overlaps", ["all", "duplicates"]],
      ] as const) {
        const where: StoragePredicate = { field: "tags", op, value: values };
        const page = await records.query({ index: "tags", where, fields: [], limit: 1 });
        expect(page.records.map(({ recordId }) => recordId)).toEqual(ids.slice(0, 1));
        expect((await records.aggregate({ index: "tags", where })).count).toBe(ids.length);
        expect((await records.aggregate({ index: "tags", where: { not: where } })).count).toBe(6 - ids.length);
      }
      expect(
        (await records.aggregate({ index: "tags", where: { field: "tags", op: "containsAll", value: [] } })).count,
      ).toBe(4);
      expect(
        (await records.aggregate({ index: "tags", where: { field: "tags", op: "overlaps", value: null } })).count,
      ).toBe(0);
    }
  } finally {
    await fixture.close();
  }
});
