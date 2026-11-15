import { expect, test } from "bun:test";
import type { RecordEdit, StorageComputedField } from "pstdio-sync-contracts";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

test("sixteen conditional metrics compare related text without terminating the query engine", async () => {
  const fixture = await createExtensionStorageFixture();
  try {
    const owner = { workbenchId: fixture.projectAId, extensionId: "related-metrics" };
    const service = createDocumentStorageDBService(fixture.db);
    const core = service.open({ owner: { ...owner, extensionId: "pstdio" } }).records;
    await core.commit({
      operationId: "numbers",
      edits: Array.from({ length: 16 }, (_, i) => ({
        recordId: String(i),
        replace: {
          id: String(i),
          extensionId: owner.extensionId,
          kind: "thing",
          prefix: "T",
          value: i + 1,
          aliases: [],
        },
      })),
    });
    {
      const records = service.open({ owner }).records;
      await records.commit({
        operationId: "seed",
        edits: Array.from({ length: 16 }, (_, i): RecordEdit[] => [
          { recordId: `resource/${i}`, replace: { value: { nested: { metadata: { id: String(i) } } } } },
          {
            recordId: `placement/${i}`,
            replace: { value: { nested: { metadata: { resourceId: String(i), group: null, position: `p${i}` } } } },
          },
        ]).flat(),
      });
      await records.defineIndexes([
        {
          name: "resources",
          prefix: "resource/",
          identity: { kind: "thing", idField: "id", shorthandField: "shorthand" },
          fields: {
            id: { path: ["value", "nested", "metadata", "id"], type: "string" },
            shorthand: { path: ["unused"], type: "string" },
            group: {
              type: "string",
              lookup: { index: "placements", on: [{ sourceField: "id", relatedField: "resourceId" }], field: "group" },
            },
            position: {
              type: "string",
              lookup: {
                index: "placements",
                on: [{ sourceField: "id", relatedField: "resourceId" }],
                field: "position",
              },
            },
          },
        },
        {
          name: "placements",
          prefix: "placement/",
          fields: {
            resourceId: { path: ["value", "nested", "metadata", "resourceId"], type: "string" },
            group: { path: ["value", "nested", "metadata", "group"], type: "string" },
            position: { path: ["value", "nested", "metadata", "position"], type: "string" },
          },
          equality: ["resourceId"],
        },
      ]);
      const computed: Record<string, StorageComputedField> = {},
        metrics: Record<string, { operation: "sum"; field: string }> = {};
      for (let i = 0; i < 16; i++) {
        const name = `before${i}`;
        computed[name] = {
          type: "number",
          cases: [
            {
              when: {
                any: [
                  { field: "group", op: "in", value: [] },
                  {
                    all: [
                      { field: "group", op: "eq", value: null },
                      { field: "position", op: "lt", value: `p${i}` },
                    ],
                  },
                ],
              },
              value: 1,
            },
          ],
          otherwise: 0,
        };
        metrics[name] = { operation: "sum", field: name };
      }
      const result = await records.aggregate({ index: "resources", computed, metrics });
      expect(result.count).toBe(16);
      expect(result.metrics).toEqual(
        Object.fromEntries(
          Array.from({ length: 16 }, (_, i) => [
            `before${i}`,
            Array.from({ length: 16 }, (_, j) => `p${j}`).filter((position) => position < `p${i}`).length,
          ]),
        ),
      );
    }
  } finally {
    await fixture.close();
  }
});
