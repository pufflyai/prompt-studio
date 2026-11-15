import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import type { StorageRecordIndex } from "pstdio-sync-contracts";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

test("scoped collection selection filters the scope before paging without loading sibling scopes", async () => {
  const f = await createExtensionStorageFixture();
  try {
    const owner = { workbenchId: f.projectAId, extensionId: "scope-query" };
    for (const records of [
      createDocumentStorageDBService(f.db).open({ owner }).records,
      createMemoryStorage(owner).records,
    ]) {
      await records.commit({
        operationId: "scopes",
        edits: Array.from({ length: 103 }, (_, i) => ({
          recordId: JSON.stringify([
            "supervisor",
            i === 102 ? "selected" : "other",
            "collection",
            "dispatches",
            String(i),
          ]),
          replace: { workspaceId: String(i) },
        })),
      });
      const index = {
        name: "dispatches",
        prefix: '["supervisor",',
        fields: {
          scopeId: { path: ["unused"], type: "string", derive: { kind: "scopeId" } },
          workspaceId: { path: ["workspaceId"], type: "string" },
        },
        equality: ["scopeId"],
      } as unknown as StorageRecordIndex;
      await records.defineIndexes([index]);
      const page = await records.query({
        index: "dispatches",
        where: { field: "scopeId", op: "eq", value: "selected" },
        fields: ["workspaceId"],
        limit: 1,
      });
      expect(page.records.map(({ fields }) => fields.workspaceId)).toEqual(["102"]);
      expect(page.cursor).toBeNull();
    }
  } finally {
    await f.close();
  }
});
