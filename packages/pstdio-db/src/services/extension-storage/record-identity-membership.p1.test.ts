import { expect, test } from "bun:test";
import { drizzle } from "drizzle-orm/pglite";
import type { RecordEdit, StorageRecordIndex } from "pstdio-sync-contracts";
import { createDb } from "../../db/connection.pglite";
import * as schema from "../../db/schemas.pg";
import { createDocumentStorageDBService } from "./document-storage";
import { attachIndexNodeFiles, createMemoryIndexNodeFiles } from "./index-node-files";

test("canonical filtered counts use maintained identity membership without reading each core document", async () => {
  const connection = await createDb({ path: ":memory:" });
  let capture = false;
  const statements: { query: string; params: unknown[] }[] = [];
  const db = drizzle(connection.pglite, {
    schema,
    logger: {
      logQuery(query, params) {
        if (capture && query.includes("AS count") && query.includes("FROM storage_current_records"))
          statements.push({ query, params });
      },
    },
  });
  attachIndexNodeFiles(db, createMemoryIndexNodeFiles());
  const owner = { workbenchId: crypto.randomUUID(), extensionId: "membership.example" };
  const store = createDocumentStorageDBService(db);
  const rows = store.open({ owner }).records;
  const core = store.open({ owner: { ...owner, extensionId: "pstdio" } }).records;
  const definition: StorageRecordIndex = {
    name: "items",
    prefix: "item/",
    identity: { kind: "thing", idField: "id", shorthandField: "label" },
    fields: {
      id: { path: ["id"], type: "string" },
      label: { path: ["label"], type: "string" },
      category: {
        path: ["category"],
        type: "string",
        derive: { kind: "expression", expression: { variable: "value" } },
      },
      title: { path: ["title"], type: "string" },
    },
    countBy: ["category"],
  };
  try {
    const now = new Date().toISOString();
    await db
      .insert(schema.projects)
      .values({ id: owner.workbenchId, name: "Test", shorthand: "TEST", created_at: now, updated_at: now });
    for (let start = 0; start < 300; start += 100) {
      await rows.commit({
        operationId: `rows-${start}`,
        edits: Array.from({ length: 100 }, (_, i): RecordEdit => {
          const id = `resource-${start + i}`;
          return {
            recordId: `item/${id}`,
            replace: { id, title: "Matches the supported substring", category: "active" },
          };
        }),
      });
      await core.commit({
        operationId: `core-${start}`,
        edits: Array.from({ length: 100 }, (_, i): RecordEdit => {
          const n = start + i;
          return {
            recordId: `resource-${n}`,
            replace: {
              id: `resource-${n}`,
              extensionId: owner.extensionId,
              kind: "thing",
              prefix: "T",
              value: n + 1,
              aliases: [],
            },
          };
        }),
      });
    }
    await rows.defineIndexes([definition, { ...definition, name: "reference", countBy: undefined }]);
    await rows.query({ index: "items", fields: ["id"], limit: 1 });
    capture = true;
    const counted = await rows.aggregate({
      index: "items",
      where: { field: "title", op: "textContains", value: "supported substring" },
      fingerprint: ["id"],
    });
    capture = false;
    expect(counted.count).toBe(300);
    expect(statements).toHaveLength(1);
    const statement = statements[0];
    const explained = await connection.pglite.query(
      `EXPLAIN (ANALYZE, FORMAT JSON) ${statement.query}`,
      statement.params,
    );
    const coreVisits = (value: unknown): number => {
      if (!value || typeof value !== "object") return 0;
      const node = value as Record<string, unknown>;
      const visits =
        node.Alias === "core"
          ? Number(node["Actual Loops"]) * (Number(node["Actual Rows"]) + Number(node["Rows Removed by Filter"] ?? 0))
          : 0;
      return visits + Object.values(node).reduce<number>((sum, child) => sum + coreVisits(child), 0);
    };
    expect(coreVisits(explained.rows)).toBeLessThanOrEqual(1);
    expect(
      (
        await rows.aggregate({
          index: "reference",
          where: { field: "title", op: "textContains", value: "supported substring" },
          fingerprint: ["id"],
        })
      ).count,
    ).toBe(counted.count);
    const select = { fields: ["id"], limit: 5 };
    expect((await rows.query({ index: "items", ...select })).records.map(({ fields }) => fields.id)).toEqual(
      (await rows.query({ index: "reference", ...select })).records.map(({ fields }) => fields.id),
    );
  } finally {
    await connection.close();
  }
}, 30000);
