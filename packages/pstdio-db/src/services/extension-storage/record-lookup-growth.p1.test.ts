import { expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import type { RecordEdit, StorageRecordIndex } from "pstdio-sync-contracts";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";
import { readQueryOwner } from "./record-query-owner";
import { recordPageSql, recordScopeSql } from "./record-query-sql";

test("broad related ordering avoids repeated prefix scans after an initially empty owner grows", async () => {
  const f = await createExtensionStorageFixture();
  const owner = { workbenchId: f.projectAId, extensionId: "lookup-growth" };
  const records = createDocumentStorageDBService(f.db).open({ owner }).records;
  const indexes: StorageRecordIndex[] = [
    {
      name: "resources",
      prefix: "resource/",
      fields: {
        id: { path: ["id"], type: "string" },
        group: {
          type: "string",
          lookup: { index: "placements", on: [{ sourceField: "id", relatedField: "resourceId" }], field: "group" },
        },
      },
    },
    {
      name: "placements",
      prefix: "placement/",
      fields: { resourceId: { path: ["resourceId"], type: "string" }, group: { path: ["group"], type: "string" } },
      equality: ["resourceId"],
      orderBy: [{ field: "group", direction: "asc" }],
    },
  ];
  const resolve = (name: string) => indexes.find((index) => index.name === name)!;
  try {
    await records.defineIndexes(indexes);
    const edits: RecordEdit[] = [
      ...Array.from({ length: 1000 }, (_, i) => ({ recordId: `resource/${i}`, replace: { id: String(i) } })),
      ...Array.from({ length: 40 }, (_, i) => ({
        recordId: `placement/${i}`,
        replace: { resourceId: String(i), group: "release" },
      })),
      ...Array.from({ length: 3000 }, (_, i) => ({ recordId: `unrelated/${i}`, replace: { id: String(i) } })),
    ];
    for (let start = 0; start < edits.length; start += 100)
      await records.commit({ operationId: String(start), edits: edits.slice(start, start + 100) });
    const queryOwner = await readQueryOwner(f.db, owner);
    const ordered = { ...indexes[0], orderBy: [{ field: "group", direction: "asc" as const }] };
    const plan = await f.db.execute(
      sql`EXPLAIN (ANALYZE, FORMAT JSON) ${recordPageSql(ordered, ["id"], recordScopeSql(queryOwner, ordered), 10, 0, resolve, queryOwner)}`,
    );
    const visits = (value: unknown): number => {
      if (!value || typeof value !== "object") return 0;
      const node = value as Record<string, unknown>;
      return (
        (node["Relation Name"] === "records" && Number(node["Actual Loops"]) >= 1000
          ? Number(node["Actual Loops"]) * (Number(node["Actual Rows"]) + Number(node["Rows Removed by Filter"] ?? 0))
          : 0) + Object.values(node).reduce<number>((sum, child) => sum + visits(child), 0)
      );
    };
    expect(visits(plan.rows)).toBeLessThanOrEqual(2000);
    expect((await records.aggregate({ index: "resources", groupBy: "group", groupLimit: 10 })).groups).toEqual([
      { value: "release", count: 40 },
      { value: null, count: 960 },
    ]);
  } finally {
    await f.close();
  }
}, 30000);
