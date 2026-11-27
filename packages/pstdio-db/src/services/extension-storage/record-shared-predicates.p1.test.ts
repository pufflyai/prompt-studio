import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import type { StorageComputedField, StoragePredicate } from "pstdio-sync-contracts";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

test("repeated relationship conditions retain record scopes through pages and grouped metrics", async () => {
  const fixture = await createExtensionStorageFixture();
  try {
    const service = createDocumentStorageDBService(fixture.db);
    const owner = { workbenchId: fixture.projectAId, extensionId: "shared-predicates" };
    await service.open({ owner: { ...owner, extensionId: "another-owner" } }).records.commit({
      operationId: "unrelated",
      edits: [{ recordId: "foreign", replace: { id: "foreign", parent: "c", enabled: true } }],
    });
    for (const records of [service.open({ owner }).records, createMemoryStorage(owner).records]) {
      await records.commit({
        operationId: "seed",
        edits: [
          { recordId: "a", replace: { id: "a", enabled: true } },
          { recordId: "b", replace: { id: "b", enabled: false } },
          { recordId: "c", replace: { id: "c", enabled: true } },
          { recordId: "a1", replace: { id: "a1", parent: "a", enabled: true } },
          { recordId: "b1", replace: { id: "b1", parent: "b", enabled: true } },
          { recordId: "c1", replace: { id: "c1", parent: "c", enabled: "invalid" } },
        ],
      });
      await records.defineIndexes([
        {
          name: "nodes",
          fields: {
            id: { path: ["id"], type: "string" },
            parent: { path: ["parent"], type: "string" },
            enabled: { path: ["enabled"], type: "boolean" },
          },
          equality: ["parent"],
        },
      ]);
      const related: StoragePredicate = {
        exists: {
          index: "nodes",
          on: [{ sourceField: "id", relatedField: "parent" }],
          where: {
            all: [
              { field: "enabled", op: "eq", value: true },
              { test: { op: "gt", args: [{ field: "id" }, { field: "id", up: 1 }] } },
            ],
          },
        },
      };
      const computed: Record<string, StorageComputedField> = {
        hasChild: { type: "boolean", cases: [{ when: related, value: true }], otherwise: false },
        ready: {
          type: "number",
          cases: [{ when: { all: [{ field: "enabled", op: "eq", value: true }, related] }, value: 1 }],
          otherwise: 0,
        },
        absent: { type: "number", cases: [{ when: { not: related }, value: 1 }], otherwise: 0 },
      };
      const selection = {
        index: "nodes",
        computed,
        where: { field: "parent", op: "missing" as const },
        fields: ["id", "parent", "hasChild", "ready", "absent"],
        orderBy: [{ field: "id", direction: "asc" as const }],
        limit: 1,
      };
      const first = await records.query(selection);
      const second = await records.query({ ...selection, cursor: first.cursor! });
      const last = await records.query({ ...selection, cursor: second.cursor! });
      expect([first, second, last].map((page) => page.records[0].fields)).toEqual([
        { id: "a", parent: null, hasChild: true, ready: 1, absent: 0 },
        { id: "b", parent: null, hasChild: true, ready: 0, absent: 0 },
        { id: "c", parent: null, hasChild: false, ready: 0, absent: 1 },
      ]);
      expect((await records.query({ ...selection, offset: 1 })).records).toEqual(second.records);
      const summary = await records.aggregate({
        ...selection,
        groupBy: "enabled",
        metrics: { ready: { operation: "sum", field: "ready" }, absent: { operation: "sum", field: "absent" } },
      });
      expect(summary.count).toBe(3);
      expect(summary.metrics).toEqual({ ready: 1, absent: 1 });
      expect(summary.groups.map(({ value, count, metrics }) => ({ value, count, metrics }))).toEqual([
        { value: false, count: 1, metrics: { ready: 0, absent: 0 } },
        { value: true, count: 2, metrics: { ready: 1, absent: 1 } },
      ]);
    }
  } finally {
    await fixture.close();
  }
});
