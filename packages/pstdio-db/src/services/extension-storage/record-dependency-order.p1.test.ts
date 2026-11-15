import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import type { StorageRecordQuery } from "pstdio-sync-contracts";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

test("dependency-ordered batches select global readiness before materializing a bounded page", async () => {
  const fixture = await createExtensionStorageFixture();
  try {
    const owner = { workbenchId: fixture.projectAId, extensionId: "graph" };
    const native = createDocumentStorageDBService(fixture.db).open({ owner }).records;
    for (const records of [native, createMemoryStorage().records]) {
      await records.defineIndexes([
        {
          name: "graph",
          fields: {
            id: { type: "string", path: ["id"] },
            dependencies: { type: "array", path: ["dependencies"] },
            placed: { type: "boolean", path: ["placed"] },
            rank: { type: "number", path: ["rank"] },
            kind: { type: "string", path: ["kind"] },
          },
          orderBy: [{ field: "rank", direction: "asc" }],
        },
      ]);
      const n = 203;
      await records.commit({
        operationId: "seed",
        edits: Array.from({ length: n }, (_, i) => ({
          recordId: String(i),
          replace: {
            id: String(i),
            rank: i,
            dependencies: i + 1 < n ? [String(i + 1)] : ["absent"],
            placed: false,
            body: "Never selected",
          },
        })),
      });
      const query = {
        index: "graph",
        dependencyOrder: { idField: "id", dependenciesField: "dependencies" },
        fields: ["id"],
        limit: 100,
        where: { field: "placed", op: "ne", value: true },
      } satisfies StorageRecordQuery;
      const order: string[] = [];
      for (let batch = 0; batch < 4; batch++) {
        const page = await records.query(query);
        if (!page.records.length) break;
        expect(page.records.length).toBeLessThanOrEqual(100);
        expect(page.cursor).toBeNull();
        for (const row of page.records) {
          expect(Object.keys(row.fields)).toEqual(["id"]);
          order.push(String(row.fields.id));
        }
        await records.commit({
          operationId: crypto.randomUUID(),
          edits: page.records.map(({ recordId }) => ({ recordId, set: { "/placed": true } })),
        });
      }
      expect(order).toEqual(Array.from({ length: n }, (_, i) => String(n - 1 - i)));
      await expect(records.query({ ...query, offset: 1 })).rejects.toThrow("Dependency order");
      await expect(records.query({ ...query, limit: 101 })).rejects.toThrow("Dependency order");
      await records.commit({
        operationId: "edge-cases",
        edits: [
          { recordId: "missing/a", replace: { kind: "missing", rank: 0, dependencies: ["x", "outside", "deleted"] } },
          { recordId: "missing/b", replace: { kind: "missing", rank: 1, id: "b", dependencies: [] } },
          { recordId: "missing/x", replace: { kind: "missing", rank: 2, id: "x", dependencies: [] } },
          { recordId: "excluded", replace: { kind: "other", rank: 0, id: "outside", dependencies: [] } },
          {
            recordId: "deleted",
            deleted: true,
            replace: { kind: "missing", rank: 0, id: "deleted", dependencies: [] },
          },
          { recordId: "duplicate/a", replace: { kind: "duplicate", rank: 0, id: "a", dependencies: ["x"] } },
          { recordId: "duplicate/x1", replace: { kind: "duplicate", rank: 1, id: "x", dependencies: [] } },
          { recordId: "duplicate/b", replace: { kind: "duplicate", rank: 2, id: "b", dependencies: [] } },
          { recordId: "duplicate/x2", replace: { kind: "duplicate", rank: 3, id: "x", dependencies: [] } },
          { recordId: "cycle/a", replace: { kind: "cycle", rank: 0, id: "left", dependencies: ["right"] } },
          { recordId: "cycle/b", replace: { kind: "cycle", rank: 1, id: "right", dependencies: ["left"] } },
          { recordId: "cycle/c", replace: { kind: "cycle", rank: 2, id: "self", dependencies: ["self"] } },
        ],
      });
      for (const [kind, expected] of [
        ["missing", ["b", "x", "a"]],
        ["duplicate", ["x1", "a", "b", "x2"]],
        ["cycle", ["c", "a", "b"]],
      ] as const) {
        const page = await records.query({ ...query, where: { field: "kind", op: "eq", value: kind } });
        expect(page.records.map(({ recordId }) => recordId)).toEqual(expected.map((id) => `${kind}/${id}`));
      }
    }
  } finally {
    await fixture.close();
  }
});
