import { afterAll, beforeAll, expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { drizzle } from "drizzle-orm/pglite";
import type { RecordEdit, StoragePredicate, StorageRecordIndex } from "pstdio-sync-contracts";
import * as schema from "../../db/schemas.pg";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

let fixture: Awaited<ReturnType<typeof createExtensionStorageFixture>>;
let service: ReturnType<typeof createDocumentStorageDBService>;
let records: ReturnType<ReturnType<typeof createDocumentStorageDBService>["open"]>["records"];
const ids = Array.from({ length: 5_000 }, () => crypto.randomUUID());
const statements: { query: string; params: unknown[] }[] = [];
let capture = false;
const indexes: StorageRecordIndex[] = [
  {
    name: "resources",
    prefix: "resource/",
    identity: { kind: "thing", idField: "id", shorthandField: "shorthand" },
    fields: {
      id: { path: ["id"], type: "string", derive: { kind: "expression", expression: { variable: "value" } } },
      state: { path: ["state"], type: "string", derive: { kind: "expression", expression: { variable: "value" } } },
      position: {
        path: ["position"],
        type: "string",
        derive: { kind: "expression", expression: { variable: "value" } },
      },
      shorthand: { path: ["unused"], type: "string" },
    },
    equality: ["id", "state"],
  },
  {
    name: "placements",
    prefix: "placement/",
    fields: { resourceId: { path: ["value", "resourceId"], type: "string" } },
    equality: ["resourceId"],
  },
];

beforeAll(async () => {
  fixture = await createExtensionStorageFixture();
  const db = drizzle(fixture.db.$client, {
    schema,
    logger: {
      logQuery: (query, params) => {
        if (capture) statements.push({ query, params });
      },
    },
  });
  service = createDocumentStorageDBService(db);
  const owner = { workbenchId: fixture.projectAId, extensionId: "exclusion-scale" };
  records = service.open({ owner }).records;
  const core = service.open({ owner: { ...owner, extensionId: "pstdio" } }).records;
  await records.defineIndexes(indexes);
  for (let offset = 0; offset < ids.length; offset += 100) {
    const batch = ids.slice(offset, offset + 100);
    await records.commit({
      operationId: `resources-${offset}`,
      edits: batch.map((id, i) => ({
        recordId: `resource/${id}`,
        replace: {
          id,
          state: offset + i < 205 ? "done" : "ready",
          position: String(offset + i).padStart(8, "0"),
          body: "Large resource body. ".repeat(256),
        },
      })),
    });
    await core.commit({
      operationId: `identities-${offset}`,
      edits: batch.map((id, i) => ({
        recordId: id,
        replace: { id, kind: "thing", prefix: "X", value: offset + i + 1, extensionId: owner.extensionId, aliases: [] },
      })),
    });
  }
  await records.commit({
    operationId: "placed-prefix",
    edits: ids
      .slice(0, 100)
      .map((id) => ({ recordId: `placement/${id}`, replace: { value: { resourceId: id }, sortOrder: null } })),
  });
  await service.flushStatistics();
}, 30_000);

afterAll(async () => {
  await service?.flushStatistics();
  await fixture?.close();
});

test("an ordered page of unplaced resources does not rescan every placement for each resource", async () => {
  capture = true;
  const page = await records.query({
    index: "resources",
    where: { not: { exists: { index: "placements", on: [{ sourceField: "id", relatedField: "resourceId" }] } } },
    computed: {
      completedRank: {
        type: "number",
        cases: [{ when: { field: "state", op: "in", value: ["done"] }, value: 0 }],
        otherwise: 1,
      },
    },
    fields: ["id"],
    orderBy: [
      { field: "completedRank", direction: "asc" },
      { field: "position", direction: "asc" },
      { field: "id", direction: "asc" },
    ],
    limit: 100,
  });
  capture = false;
  expect(page.records.map(({ fields }) => fields.id)).toEqual(ids.slice(100, 200));
  const statement = statements.find(
    ({ query }) => query.includes(" AS fields,") && query.includes("FROM storage_current_records"),
  )!;
  const plan = await fixture.db.$client.query(`EXPLAIN (ANALYZE, FORMAT JSON) ${statement.query}`, statement.params);
  const visits = (value: unknown): number => {
    if (!value || typeof value !== "object") return 0;
    const node = value as Record<string, unknown>;
    return (
      (String(node.Alias).startsWith("related_")
        ? Number(node["Actual Loops"]) * (Number(node["Actual Rows"]) + Number(node["Rows Removed by Filter"] ?? 0))
        : 0) +
      Number(node["Rows Removed by Join Filter"] ?? 0) * Number(node["Actual Loops"] ?? 0) +
      Object.values(node).reduce<number>((sum, child) => sum + visits(child), 0)
    );
  };
  expect(visits(plan.rows)).toBeLessThanOrEqual(10_000);
});

test("absence preserves missing, null and exact encoded string keys in DB and memory", async () => {
  const declarations: StorageRecordIndex[] = [
    { name: "sources", prefix: "source/", fields: { key: { path: ["key"], type: "string" } }, equality: ["key"] },
    { name: "targets", prefix: "target/", fields: { key: { path: ["key"], type: "string" } }, equality: ["key"] },
  ];
  const owner = { workbenchId: fixture.projectAId, extensionId: "absence-keys" };
  const edits: RecordEdit[] = [
    { recordId: "source/missing", replace: {} },
    { recordId: "source/null", replace: { key: null } },
    { recordId: "source/unicode", replace: { key: "café" } },
    { recordId: "source/encoded", replace: { key: "\u0000edge" } },
    { recordId: "source/case", replace: { key: "CAFÉ" } },
    { recordId: "source/unmatched", replace: { key: "other" } },
    { recordId: "target/null", replace: { key: null } },
    { recordId: "target/missing", replace: {} },
    { recordId: "target/unicode", replace: { key: "café" } },
    { recordId: "target/encoded", replace: { key: "\u0000edge" } },
    { recordId: "target/deleted", replace: { key: "other" }, deleted: true },
  ];
  const foreign = service.open({ owner: { ...owner, extensionId: "unrelated-absence-keys" } }).records;
  await foreign.commit({ operationId: "foreign", edits: [{ recordId: "target/foreign", replace: { key: "other" } }] });
  for (const selected of [service.open({ owner }).records, createMemoryStorage().records]) {
    await selected.defineIndexes(declarations);
    await selected.commit({ operationId: "keys", edits });
    const absent: StoragePredicate = {
      not: { exists: { index: "targets", on: [{ sourceField: "key", relatedField: "key" }] } },
    };
    const page = await selected.query({ index: "sources", where: absent, fields: ["key"], limit: 100 });
    expect(page.records.map(({ recordId }) => recordId)).toEqual([
      "source/case",
      "source/missing",
      "source/null",
      "source/unmatched",
    ]);
    const point = await selected.query({
      index: "sources",
      where: { all: [{ field: "key", op: "eq", value: "other" }, absent] },
      fields: ["key"],
      limit: 1,
    });
    expect(point.records.map(({ recordId }) => recordId)).toEqual(["source/unmatched"]);
  }
});
