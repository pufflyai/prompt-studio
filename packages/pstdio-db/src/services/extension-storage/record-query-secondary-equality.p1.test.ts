import { expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import type { StorageRecordIndex } from "pstdio-sync-contracts";
import { analyzeRecordProjection } from "../../db/record-projection-statistics";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";
import { readQueryOwner } from "./record-query-owner";
import { predicateSql, recordPageSql, recordScopeSql } from "./record-query-sql";

test("an empty page seeks a nonleading equality field instead of walking every ordered resource", async () => {
  const f = await createExtensionStorageFixture();
  try {
    const owner = { workbenchId: f.projectAId, extensionId: "ext.example" };
    const records = createDocumentStorageDBService(f.db).open({ owner }).records;
    const index: StorageRecordIndex = {
      name: "work-items",
      fields: {
        id: { path: ["id"], type: "string" },
        status: { path: ["status"], type: "string" },
        rank: { path: ["rank"], type: "number" },
      },
      equality: ["id", "status"],
      orderBy: [{ field: "rank", direction: "asc" }],
    };
    await records.defineIndexes([index]);
    await records.commit({
      operationId: "seed",
      edits: Array.from({ length: 5000 }, (_, rank) => ({
        recordId: `item-${rank}`,
        replace: { id: `item-${rank}`, status: "ready", rank },
      })),
    });
    const target = () => f.db.execute(sql`SHOW default_statistics_target`);
    const before = (await target()).rows;
    await f.db.transaction((tx) => analyzeRecordProjection((statement) => tx.execute(sql.raw(statement))));
    expect((await target()).rows).toEqual(before);
    const where = { field: "status", op: "eq" as const, value: "done" };
    expect((await records.query({ index: index.name, where, fields: ["id"], limit: 100 })).records).toEqual([]);
    const statement = recordPageSql(
      index,
      ["id"],
      sql`${recordScopeSql(await readQueryOwner(f.db, owner), index)} AND ${predicateSql(index, where)}`,
      101,
    );
    const result = await f.db.execute<{ "QUERY PLAN": { Plan: Record<string, unknown> }[] }>(
      sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${statement}`,
    );
    const root = result.rows[0]["QUERY PLAN"][0].Plan;
    const plan = JSON.stringify(root);
    // An absent status should seek a small index range, not visit every leaf of the ID-first index.
    expect(Number(root["Shared Hit Blocks"]) + Number(root["Shared Read Blocks"])).toBeLessThan(32);
    expect(plan).not.toContain("Seq Scan");
    expect(plan).not.toMatch(/"Rows Removed by Filter":[1-9]/);
    expect(plan).toContain("Index Cond");
    await records.defineIndexes([]);
    expect(
      (await f.db.execute(sql`SELECT indexname FROM pg_indexes WHERE indexname LIKE 'storage_query_%'`)).rows,
    ).toEqual([]);
  } finally {
    await f.close();
  }
});
