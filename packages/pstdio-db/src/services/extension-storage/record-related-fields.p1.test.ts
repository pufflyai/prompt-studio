import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import type { RecordEdit, StorageRecordQuery } from "pstdio-sync-contracts";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

test("related selections bind computed fields before counting and paging the source resource", async () => {
  const f = await createExtensionStorageFixture();
  try {
    const owner = { workbenchId: f.projectAId, extensionId: "related-fields" };
    for (const records of [
      createDocumentStorageDBService(f.db).open({ owner }).records,
      createMemoryStorage(owner).records,
    ]) {
      await records.commit({
        operationId: "seed",
        edits: Array.from({ length: 103 }, (_, i): RecordEdit[] => [
          { recordId: `task/${i}`, replace: { id: String(i), status: i < 100 ? "done" : "ready" } },
          { recordId: `request/${i}`, replace: { id: String(i), taskId: String(i) } },
        ]).flat(),
      });
      await records.defineIndexes([
        {
          name: "tasks",
          prefix: "task/",
          fields: { id: { path: ["id"], type: "string" }, status: { path: ["status"], type: "string" } },
          equality: ["id"],
        },
        {
          name: "requests",
          prefix: "request/",
          fields: { id: { path: ["id"], type: "string" }, taskId: { path: ["taskId"], type: "string" } },
        },
      ]);
      const selection = {
        index: "requests",
        related: {
          tasks: {
            computed: {
              eligible: {
                type: "boolean",
                cases: [{ when: { field: "status", op: "eq", value: "ready" }, value: true }],
                otherwise: false,
              },
            },
          },
        },
        where: {
          exists: {
            index: "tasks",
            on: [{ sourceField: "taskId", relatedField: "id" }],
            where: { field: "eligible", op: "eq", value: true },
          },
        },
        fields: ["id"],
        limit: 2,
      } as unknown as StorageRecordQuery;
      const first = await records.query(selection);
      expect(first.records.map(({ fields }) => fields.id)).toEqual(["100", "101"]);
      expect((await records.aggregate(selection)).count).toBe(3);
      const second = await records.query({ ...selection, cursor: first.cursor! });
      expect(second.records.map(({ fields }) => fields.id)).toEqual(["102"]);
      await expect(records.query({ ...selection, related: {}, cursor: first.cursor! })).rejects.toThrow();
      const recursive = {
        ...selection,
        related: {
          tasks: {
            computed: {
              eligible: {
                type: "boolean" as const,
                cases: [{ when: { field: "eligible", op: "eq" as const, value: true }, value: true }],
                otherwise: false,
              },
            },
          },
        },
      };
      await expect(records.query(recursive)).rejects.toThrow("Unknown index field");
      await expect(records.aggregate(recursive)).rejects.toThrow("Unknown index field");
    }
  } finally {
    await f.close();
  }
});
