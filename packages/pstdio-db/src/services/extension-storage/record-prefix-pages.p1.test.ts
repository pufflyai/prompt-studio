import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { sql } from "drizzle-orm";
import { requestedRecordIndex } from "pstdio-sync/records";
import type { StorageRecordIndex, StorageRecordQuery } from "pstdio-sync-contracts";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";
import { readQueryOwner } from "./record-query-owner";
import { predicateSql, recordPageSql, recordScopeSql } from "./record-query-sql";

const index: StorageRecordIndex = {
  name: "ordered-items",
  fields: {
    id: { path: ["id"], type: "string", derive: { kind: "expression", expression: { variable: "value" } } },
    created: { path: ["created"], type: "number", derive: { kind: "timestamp" } },
    position: { path: ["position"], type: "string", derive: { kind: "expression", expression: { variable: "value" } } },
    tags: { path: ["tags"], type: "object", derive: { kind: "expression", expression: { variable: "value" } } },
    title: { path: ["title"], type: "string", derive: { kind: "expression", expression: { variable: "value" } } },
  },
  equality: ["id"],
  orderBy: [{ field: "position", direction: "asc" }],
  alternateOrders: [
    [
      { field: "created", direction: "desc" },
      { field: "position", direction: "asc" },
    ],
  ],
};

test("short string ordered pages read a bounded candidate set even when the leading order ties", async () => {
  const f = await createExtensionStorageFixture();
  try {
    const owner = { workbenchId: f.projectAId, extensionId: "ext.example" };
    const records = createDocumentStorageDBService(f.db).open({ owner }).records;
    await records.defineIndexes([index]);
    await records.commit({
      operationId: "seed",
      edits: Array.from({ length: 1000 }, (_, n) => ({
        recordId: `row-${n}`,
        replace: {
          id: `row-${n}`,
          created: "2026-11-19T20:00:00.000Z",
          position: String(n).padStart(5, "0"),
          title: "Background work",
          tags: { priority: ["high"] },
        },
      })),
    });
    await f.db.execute(sql`ANALYZE records`);
    const computed: NonNullable<StorageRecordQuery["computed"]> = {
      priority: {
        type: "string",
        expression: {
          op: "first",
          args: [
            {
              each: { get: { field: "tags" }, key: "priority" },
              as: "selected",
              mode: "filter",
              where: {
                op: "eq",
                args: [
                  { get: { literal: { low: true, high: true } }, key: { variable: "selected" } },
                  { literal: true },
                ],
              },
            },
          ],
        },
      },
    };
    const orderBy = index.alternateOrders![0];
    const prepared = requestedRecordIndex(index, { computed, orderBy });
    const where = {
      all: [
        { field: "title", op: "textContains" as const, value: "Background" },
        { field: "priority", op: "notIn" as const, value: ["low"] },
      ],
    };
    expect(
      (await records.query({ index: index.name, computed, orderBy, where, limit: 10 })).records.map((r) => r.recordId),
    ).toEqual(Array.from({ length: 10 }, (_, n) => `row-${n}`));
    const result = await f.db.execute<{ "QUERY PLAN": { Plan: Record<string, unknown> }[] }>(
      sql`EXPLAIN (ANALYZE, FORMAT JSON) ${recordPageSql(prepared, ["position"], sql`${recordScopeSql(await readQueryOwner(f.db, owner), prepared)} AND ${predicateSql(prepared, where)}`, 11, 0, undefined, await readQueryOwner(f.db, owner))}`,
    );
    const scans: number[] = [];
    const visit = (node: Record<string, unknown>) => {
      if (String(node["Node Type"]).includes("Scan") && node["Relation Name"] === "records")
        scans.push(
          (Number(node["Actual Rows"]) + Number(node["Rows Removed by Filter"] ?? 0)) * Number(node["Actual Loops"]),
        );
      for (const child of (node.Plans ?? []) as Record<string, unknown>[]) visit(child);
    };
    visit(result.rows[0]["QUERY PLAN"][0].Plan);
    expect(scans.length).toBeGreaterThan(0);
    expect(Math.max(...scans)).toBeLessThanOrEqual(32);
    const other = createDocumentStorageDBService(f.db).open({ owner: { ...owner, workbenchId: f.projectBId } }).records;
    await other.defineIndexes([index]);
    await other.commit({
      operationId: "other-owner",
      edits: [
        {
          recordId: "row-0",
          replace: { id: "row-0", created: "2027-01-01T00:00:00.000Z", position: "", title: "Other owner" },
        },
      ],
    });
    const sparse = await records.query({
      index: index.name,
      orderBy,
      limit: 2,
      where: { field: "position", op: "gte", value: "00995" },
    });
    expect(sparse.records.map((r) => r.recordId)).toEqual(["row-995", "row-996"]);
    expect((await records.query({ index: index.name, orderBy, limit: 10 })).records[0].fields.title).toBe(
      "Background work",
    );
  } finally {
    await f.close();
  }
});

test("prefix collisions preserve full string order, cursor continuation and direct offsets", async () => {
  const f = await createExtensionStorageFixture();
  try {
    const owner = { workbenchId: f.projectAId, extensionId: "ext.example" };
    const records = createDocumentStorageDBService(f.db).open({ owner }).records;
    const memory = createMemoryStorage(owner).records;
    const collisionIndex: StorageRecordIndex = {
      ...index,
      alternateOrders: [
        ...index.alternateOrders!,
        [
          { field: "created", direction: "desc" },
          { field: "position", direction: "desc" },
        ],
      ],
    };
    const positions = [`${"a".repeat(512)}z`, `${"a".repeat(512)}a`, "b", "a", "", null, "😀".repeat(300)];
    for (const store of [records, memory]) {
      await store.defineIndexes([collisionIndex]);
      await store.commit({
        operationId: "collisions",
        edits: positions.map((position, n) => ({
          recordId: `row-${n}`,
          replace: { id: `row-${n}`, created: "2026-11-19T20:00:00.000Z", position },
        })),
      });
    }
    for (const direction of ["asc", "desc"] as const) {
      const orderBy = [
        { field: "created", direction: "desc" as const },
        { field: "position", direction },
      ];
      let cursor: string | undefined;
      const expected = (await memory.query({ index: index.name, orderBy, limit: 100 })).records.map((r) => r.recordId);
      const actual: string[] = [];
      do {
        const page = await records.query({ index: index.name, orderBy, limit: 2, cursor });
        actual.push(...page.records.map((r) => r.recordId));
        cursor = page.cursor ?? undefined;
      } while (cursor);
      expect(actual).toEqual(expected);
      expect(
        (await records.query({ index: index.name, orderBy, offset: 2, limit: 2 })).records.map((r) => r.recordId),
      ).toEqual(expected.slice(2, 4));
    }
  } finally {
    await f.close();
  }
});
