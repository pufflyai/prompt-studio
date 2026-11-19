import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import type { StorageRecordIndex } from "pstdio-sync-contracts";
import { createDocumentStorageDBService } from "../../services/extension-storage/document-storage";
import { createExtensionStorageFixture } from "../../services/extension-storage/extension-storage.fixture";

export const fields = ["id", "statusId", "archived", "position", "priority", "parentId"];
export const definition: StorageRecordIndex = {
  name: "ps239-order",
  fields: {
    id: { path: ["id"], type: "string" },
    statusId: { path: ["statusId"], type: "string" },
    archived: { path: ["archived"], type: "boolean" },
    position: { path: ["position"], type: "string" },
    priority: { path: ["priority"], type: "string" },
    parentId: { path: ["parentId"], type: "string" },
  },
  equality: ["archived"],
  orderBy: [
    { field: "position", direction: "asc" },
    { field: "id", direction: "asc" },
  ],
};
export const definitions = [definition, { ...definition, name: "ps239-status", equality: ["archived", "statusId"] }];
export const active = { field: "archived", op: "eq", value: false } as const;
export const makeValue = (n: number) => ({
  id: `ticket-${String(n).padStart(5, "0")}`,
  statusId: ["backlog", "ready", "in-progress", "done"][n % 4],
  archived: n % 20 === 0,
  // Equal positions exercise the stable ID tie-breaker.
  position: String(Math.floor(n / 2)).padStart(8, "0"),
  priority: n % 10 === 0 ? "high" : "normal",
  parentId: n > 1 && n % 7 === 0 ? `ticket-${String(n - 1).padStart(5, "0")}` : null,
  title: `Synthetic background ${n}`,
  content: `# Synthetic background ${n}\n\n${"Document paragraph. ".repeat(16 + (n % 16) * 16)}`,
});

export const createFixture = async (count: number) => {
  assert([100, 1000, 5000].includes(count));
  const f = await createExtensionStorageFixture();
  const owner = { workbenchId: f.projectAId, extensionId: "ext.example" };
  const service = createDocumentStorageDBService(f.db);
  const records = service.open({ owner }).records;
  const values = Array.from({ length: count }, (_, n) => makeValue(n + 1));
  await records.defineIndexes(definitions);
  for (let offset = 0; offset < count; offset += 50) {
    await records.commit({
      operationId: `seed-${offset}`,
      edits: values.slice(offset, offset + 50).map((replace) => ({ recordId: replace.id, replace })),
    });
  }
  const foobars = service.open({ owner: { ...owner, extensionId: "ps239.foobar" } }).records;
  for (let offset = 0; offset < 5000; offset += 100) {
    await foobars.commit({
      operationId: `foobar-${offset}`,
      edits: Array.from({ length: 100 }, (_, i) => ({
        recordId: `foobar-${offset + i}`,
        replace: { title: `Foobar ${offset + i}`, rank: offset + i },
      })),
    });
  }
  // Real commit history, without adding history bodies to the narrow projection.
  for (let pass = 0; pass < 3; pass++) {
    for (let offset = 0; offset < count; offset += 100) {
      await records.commit({
        operationId: `history-${pass}-${offset}`,
        edits: values
          .slice(offset, offset + 100)
          .map((value) => ({ recordId: value.id, set: { "/historyPass": pass } })),
      });
    }
  }
  assert.equal((await records.aggregate({ index: definition.name })).count, count);
  assert.equal((await foobars.list()).length, 5000);
  // All representations receive statistics from the populated fixture, not just sidecars.
  await f.db.execute(sql`ANALYZE storage_current_records`);
  return { ...f, owner, records, values };
};

export type Fixture = Awaited<ReturnType<typeof createFixture>>;
export const elapsed = async <T>(run: () => Promise<T>) => {
  const start = performance.now();
  const value = await run();
  return { ms: performance.now() - start, value };
};
