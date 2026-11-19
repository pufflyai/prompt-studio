import { expect, test } from "bun:test";
import { drizzle } from "drizzle-orm/pglite";
import type { RecordEdit, StoragePredicate, StorageRecordIndex } from "pstdio-sync-contracts";
import { createDb } from "../../db/connection.pglite";
import * as schema from "../../db/schemas.pg";
import { createDocumentStorageDBService } from "./document-storage";
import { attachIndexNodeFiles, createMemoryIndexNodeFiles } from "./index-node-files";

test("broad filtered counts probe each identity without comparing all document pairs", async () => {
  const connection = await createDb({ path: ":memory:" });
  const statements: { query: string; params: unknown[] }[] = [];
  let capture = false;
  const db = drizzle(connection.pglite, {
    schema,
    logger: {
      logQuery(query, params) {
        if (capture) statements.push({ query, params });
      },
    },
  });
  attachIndexNodeFiles(db, createMemoryIndexNodeFiles());
  const owner = { workbenchId: crypto.randomUUID(), extensionId: "search.example" };
  const store = createDocumentStorageDBService(db);
  const rows = store.open({ owner }).records;
  const core = store.open({ owner: { ...owner, extensionId: "pstdio" } }).records;
  const projected = (path: string, type: "string" | "boolean" | "number") => ({
    path: [path],
    type,
    derive: { kind: "expression" as const, expression: { variable: "value" } },
  });
  const definition: StorageRecordIndex = {
    name: "items",
    prefix: "item/",
    identity: { kind: "thing", idField: "id", shorthandField: "label" },
    hierarchy: {
      idField: "id",
      parentField: "parent",
      labelField: "label",
      breadcrumbField: "breadcrumb",
      separator: " / ",
    },
    fields: {
      id: projected("id", "string"),
      label: projected("label", "string"),
      parent: projected("parent", "string"),
      title: projected("title", "string"),
      archived: projected("archived", "boolean"),
      category: projected("category", "string"),
      position: projected("position", "string"),
      created: projected("created", "number"),
      breadcrumb: { path: ["breadcrumb"], type: "string" },
    },
    countBy: ["archived", "category"],
    equality: ["id", "archived", "category", "parent"],
    orderBy: [{ field: "position", direction: "asc" }],
    alternateOrders: [
      [
        { field: "created", direction: "desc" },
        { field: "position", direction: "asc" },
      ],
    ],
  };
  try {
    const now = new Date().toISOString();
    await db
      .insert(schema.projects)
      .values({ id: owner.workbenchId, name: "Test", shorthand: "TEST", created_at: now, updated_at: now });

    for (let start = 0; start < 5000; start += 100) {
      await rows.commit({
        operationId: `rows-${start}`,
        edits: Array.from({ length: 100 }, (_, i): RecordEdit => {
          const n = start + i;
          return {
            recordId: `item/resource-${n}`,
            replace: {
              id: `resource-${n}`,
              title: `Scale ticket ${String(n).padStart(5, "0")}`,
              parent: n % 10 ? `resource-${n - (n % 10)}` : null,
              archived: false,
              category: ["backlog", "ready", "in-progress"][n % 3],
              position: String(n).padStart(8, "0"),
              created: 1795070000000,
            },
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
    await rows.defineIndexes([definition]);

    capture = true;
    const where: StoragePredicate = {
      all: [
        { field: "archived", op: "eq", value: false },
        {
          any: [
            { field: "title", op: "textContains", value: "Scale ticket" },
            { field: "breadcrumb", op: "textContains", value: "Scale ticket" },
          ],
        },
      ],
    };
    const result = await rows.aggregate({ index: "items", where, groupBy: "category", groupLimit: 100 });
    capture = false;
    expect(result.count).toBe(5000);
    expect(result.groups).toEqual([
      { value: "backlog", count: 1667 },
      { value: "in-progress", count: 1666 },
      { value: "ready", count: 1667 },
    ]);
    const main = statements.filter(
      (s) => s.query.includes("FROM storage_current_records") && s.query.includes("AS count"),
    );
    expect(main).toHaveLength(1);
    const plan = await connection.pglite.query(`EXPLAIN (ANALYZE, FORMAT JSON) ${main[0].query}`, main[0].params);
    const rejectedPairs = (value: unknown): number => {
      if (!value || typeof value !== "object") return 0;
      const node = value as Record<string, unknown>;
      return (
        Number(node["Rows Removed by Join Filter"] ?? 0) * Number(node["Actual Loops"] ?? 0) +
        Object.values(node).reduce<number>((sum, child) => sum + rejectedPairs(child), 0)
      );
    };
    expect(rejectedPairs(plan.rows)).toBeLessThanOrEqual(5000);
    const membershipVisits = (value: unknown): number => {
      if (!value || typeof value !== "object") return 0;
      const node = value as Record<string, unknown>;
      const visits =
        node.Alias === "identity_membership"
          ? Number(node["Actual Loops"]) * (Number(node["Actual Rows"]) + Number(node["Rows Removed by Filter"] ?? 0))
          : 0;
      return visits + Object.values(node).reduce<number>((sum, child) => sum + membershipVisits(child), 0);
    };
    expect(membershipVisits(plan.rows)).toBeLessThanOrEqual(5000);
  } finally {
    await connection.close();
  }
}, 30000);
