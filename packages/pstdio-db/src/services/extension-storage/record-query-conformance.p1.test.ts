import { afterEach, expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { sql } from "drizzle-orm";
import type { Json, StoragePredicate, StorageRecordIndex } from "pstdio-sync-contracts";
import { createProjectsDBService } from "../projects/projects";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";
import { readQueryOwner } from "./record-query-owner";
import { predicateSql, recordPageSql, recordScopeSql } from "./record-query-sql";
import { storageOwnerKey } from "./storage-owner-key";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
const fixture = async () => {
  const f = await createExtensionStorageFixture();
  cleanup.push(f.close);
  const owner = { workbenchId: f.projectAId, extensionId: "ext.example" };
  const records = createDocumentStorageDBService(f.db).open({ owner }).records;
  return { ...f, owner, records };
};

test("direct indexed page jumps match memory ordering and reject changed revisions", async () => {
  const f = await fixture();
  const memory = createMemoryStorage({ workbenchId: f.owner.workbenchId, extensionId: f.owner.extensionId }).records;
  const index: StorageRecordIndex = {
    name: "pages",
    fields: { rank: { path: ["rank"], type: "number" } },
    orderBy: [{ field: "rank", direction: "asc" }],
  };
  for (const records of [f.records, memory]) {
    await records.defineIndexes([index]);
    await records.commit({
      operationId: "seed-pages",
      edits: Array.from({ length: 9 }, (_, position) => ({
        recordId: `item-${position}`,
        replace: { rank: Math.floor(position / 2), body: "not selected" },
      })),
    });
    const first = await records.query({ index: "pages", limit: 2 });
    const jumped = await records.query({ index: "pages", limit: 2, offset: 6, revision: first.revision });
    expect(jumped.records.map((row) => row.recordId)).toEqual(["item-6", "item-7"]);
    expect(jumped.records[0].fields).toEqual({ rank: 3 });
    const last = await records.query({ index: "pages", limit: 2, cursor: jumped.cursor! });
    expect(last.records.map((row) => row.recordId)).toEqual(["item-8"]);
    expect(last.cursor).toBeNull();
    await expect(records.query({ index: "pages", offset: -1 })).rejects.toThrow("offset");
    await expect(records.query({ index: "pages", offset: 1, cursor: first.cursor! })).rejects.toThrow("offset");
    await records.commit({ operationId: "move-page", edits: [{ recordId: "item-8", replace: { rank: -1 } }] });
    await expect(records.query({ index: "pages", offset: 6, revision: first.revision })).rejects.toThrow("revision");
  }
});

test("case-insensitive equality and negation preserve selected-page and aggregate semantics", async () => {
  const f = await fixture();
  const memory = createMemoryStorage({ workbenchId: f.owner.workbenchId, extensionId: f.owner.extensionId }).records;
  const values = ["Alpha", "alpha", "ALPHA beta", "ÉİẞΣ", "A\u0000B", null, undefined, "", 7, "A😀", "𐐀"];
  const cases: [StoragePredicate, string[]][] = [
    [{ field: "title", op: "equalsIgnoreCase", value: "ALPHA" }, ["0", "1"]],
    [
      { not: { field: "title", op: "equalsIgnoreCase", value: "ALPHA" } },
      ["10", "2", "3", "4", "5", "6", "7", "8", "9"],
    ],
    [{ not: { field: "title", op: "contains", value: "alpha" } }, ["10", "3", "4", "5", "6", "7", "8", "9"]],
    [{ not: { not: { field: "title", op: "contains", value: "alpha" } } }, ["0", "1", "2"]],
    [{ field: "title", op: "equalsIgnoreCase", value: "éi\u0307ßς" }, ["3"]],
    [{ field: "title", op: "equalsIgnoreCase", value: "a\u0000b" }, ["4"]],
    [{ field: "title", op: "equalsIgnoreCase", value: "a😀" }, ["9"]],
    [{ field: "title", op: "equalsIgnoreCase", value: "𐐨" }, ["10"]],
    [{ field: "title", op: "equalsIgnoreCase", value: "" }, ["7"]],
    [{ field: "title", op: "eq", value: "alpha" }, ["1"]],
    [{ not: { field: "rank", op: "gt", value: 0 } }, values.map((_, index) => String(index)).sort()],
  ];
  for (const records of [f.records, memory]) {
    await records.defineIndexes([
      {
        name: "titles",
        fields: {
          title: { path: ["title"], type: "string" },
          rank: { path: ["rank"], type: "number" },
        },
      },
    ]);
    await records.commit({
      operationId: "text-filters",
      edits: values.map((title, index) => {
        const replace: Json = title === undefined ? {} : { title };
        return { recordId: String(index), replace };
      }),
    });
    for (const [where, ids] of cases) {
      const found: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await records.query({ index: "titles", fields: ["title"], where, limit: 2, cursor });
        found.push(...page.records.map((row) => row.recordId));
        cursor = page.cursor ?? undefined;
      } while (cursor);
      expect(found).toEqual(ids);
      expect((await records.aggregate({ index: "titles", where })).count).toBe(ids.length);
    }
    await expect(
      records.query({
        index: "titles",
        where: {
          field: "rank",
          op: "equalsIgnoreCase",
          value: "7",
        },
      }),
    ).rejects.toThrow("string");
    await expect(
      records.query({
        index: "titles",
        where: {
          field: "title",
          op: "equalsIgnoreCase",
          value: null,
        },
      }),
    ).rejects.toThrow("string");
  }
});

test("selecting or equality-indexing a long string does not prevent durable saves", async () => {
  const f = await fixture();
  const body = randomBytes(12_000).toString("base64");
  for (const equality of [undefined, ["body"]]) {
    await f.records.defineIndexes([{ name: "notes", fields: { body: { path: ["body"], type: "string" } }, equality }]);
    await f.records.commit({ operationId: String(equality), edits: [{ recordId: "note", replace: { body } }] });
    const page = await f.records.query({ index: "notes", where: { field: "body", op: "eq", value: body } });
    expect(page.records[0].fields.body).toBe(body);
  }
});

test("database and memory queries share Unicode order and reject unsupported typed operators", async () => {
  const f = await fixture();
  const memory = createMemoryStorage({ workbenchId: f.owner.workbenchId, extensionId: f.owner.extensionId }).records;
  const index: StorageRecordIndex = {
    name: "values",
    fields: {
      title: { path: ["title"], type: "string" },
      active: { path: ["active"], type: "boolean" },
      tags: { path: ["tags"], type: "array" },
    },
    orderBy: [{ field: "title", direction: "asc" }],
  };
  for (const records of [f.records, memory]) {
    await records.defineIndexes([index]);
    await records.commit({
      operationId: "unicode",
      edits: [
        { recordId: "a", replace: { title: "\uE000", active: true, tags: ["z"] } },
        { recordId: "b", replace: { title: "😀", active: false, tags: ["a", "b"] } },
      ],
    });
    expect((await records.query({ index: "values" })).records.map((row) => row.recordId)).toEqual(["a", "b"]);
    await expect(
      records.query({ index: "values", where: { field: "active", op: "contains", value: true } }),
    ).rejects.toThrow();
    await expect(
      records.query({ index: "values", where: { field: "tags", op: "gt", value: ["b"] } }),
    ).rejects.toThrow();
  }
});

test("long ordered values retain complete ordering across pages with equal prefixes", async () => {
  const f = await fixture();
  const prefix = randomBytes(12_000).toString("base64");
  for (const direction of ["asc", "desc"] as const) {
    await f.records.defineIndexes([
      {
        name: "notes",
        fields: { body: { path: ["body"], type: "string" } },
        orderBy: [{ field: "body", direction }],
      },
    ]);
    await f.records.commit({
      operationId: direction,
      edits: [
        { recordId: "a", replace: { body: `${prefix}z` } },
        { recordId: "b", replace: { body: `${prefix}a` } },
      ],
    });
    const first = await f.records.query({ index: "notes", limit: 1 });
    const second = await f.records.query({ index: "notes", limit: 1, cursor: first.cursor! });
    expect([first.records[0].recordId, second.records[0].recordId]).toEqual(
      direction === "asc" ? ["b", "a"] : ["a", "b"],
    );
    expect(second.cursor).toBeNull();
  }
});

test("reinstalling unchanged Unicode index names does not rebuild the projection", async () => {
  const f = await fixture();
  const phases: string[] = [];
  const records = createDocumentStorageDBService(f.db, undefined, (event) => phases.push(event.phase)).open({
    owner: f.owner,
  }).records;
  const indexes: StorageRecordIndex[] = ["😀", "\uE000"].map((name) => ({
    name,
    fields: { title: { path: ["title"], type: "string" } },
  }));
  await records.defineIndexes(indexes);
  await records.commit({ operationId: "seed", edits: [{ recordId: "note", replace: { title: "Saved" } }] });
  phases.length = 0;
  await records.defineIndexes(indexes);
  expect(phases).not.toContain("records-projected");
  expect((await records.query({ index: "😀" })).records[0].fields.title).toBe("Saved");
});

test("deleting a project removes its physical query indexes and statistics", async () => {
  const f = await fixture();
  await f.records.defineIndexes([
    { name: "notes", fields: { title: { path: ["title"], type: "string" } }, equality: ["title"] },
  ]);
  const physical = async () => [
    ...(await f.db.execute(sql`SELECT indexname FROM pg_indexes WHERE indexname LIKE 'storage_query_%'`)).rows,
    ...(await f.db.execute(sql`SELECT stxname FROM pg_statistic_ext WHERE stxname LIKE 'storage_query_%'`)).rows,
  ];
  expect((await physical()).length).toBeGreaterThan(0);
  await createProjectsDBService(f.db).hardDelete(f.projectAId);
  expect(await physical()).toEqual([]);
});

test("selective pages use the declared equality and ordering index before materialization", async () => {
  const f = await fixture();
  const index: StorageRecordIndex = {
    name: "ready",
    fields: {
      status: { path: ["status"], type: "string" },
      rank: { path: ["rank"], type: "number" },
    },
    equality: ["status"],
    orderBy: [{ field: "rank", direction: "asc" }],
  };
  await f.records.defineIndexes([index]);
  await f.records.commit({
    operationId: "seed-index-access",
    edits: Array.from({ length: 1000 }, (_, rank) => ({
      recordId: `row-${rank}`,
      replace: { status: rank % 100 === 0 ? "ready" : "other", rank },
    })),
  });
  await f.db.execute(sql`ANALYZE storage_current_records`);
  const page = await f.records.query({
    index: "ready",
    where: { field: "status", op: "eq", value: "ready" },
    limit: 5,
  });
  expect(page.records.map((row) => row.fields.rank)).toEqual([0, 100, 200, 300, 400]);
  const statement = recordPageSql(
    index,
    ["status", "rank"],
    sql`${recordScopeSql(await readQueryOwner(f.db, f.owner), index)} AND ${predicateSql(index, { field: "status", op: "eq", value: "ready" })}`,
    5,
  );
  const plan = await f.db.execute(sql`EXPLAIN (ANALYZE, FORMAT JSON) ${statement}`);
  const evidence = JSON.stringify(plan.rows);
  expect(evidence).toContain("storage_query_");
  expect(evidence).toContain("Index Scan");
  expect(evidence).not.toContain("Seq Scan");
  expect(evidence).toContain('"Rows Removed by Filter":0');
});

test("selective in-list pages probe the declared equality index after ordinary writes", async () => {
  const f = await createExtensionStorageFixture();
  cleanup.push(f.close);
  const service = createDocumentStorageDBService(f.db);
  const owner = { workbenchId: f.projectAId, extensionId: "ext.example" };
  const records = service.open({ owner }).records;
  const index: StorageRecordIndex = {
    name: "ordinals",
    fields: { ordinal: { path: ["ordinal"], type: "number" }, rank: { path: ["rank"], type: "number" } },
    equality: ["ordinal"],
    orderBy: [{ field: "rank", direction: "asc" }],
  };
  await records.defineIndexes([index]);
  await records.commit({
    operationId: "seed-in-list",
    edits: Array.from({ length: 5000 }, (_, ordinal) => ({
      recordId: `row-${ordinal}`,
      replace: { ordinal, rank: 5000 - ordinal },
    })),
  });
  // No manual ANALYZE: storage owns planner statistics because PGlite has no autovacuum.
  await service.flushStatistics();
  // A view-sized list: Postgres's default guess of 0.5% per value would expect half the rows.
  const where = { field: "ordinal", op: "in" as const, value: Array.from({ length: 100 }, (_, n) => n * 50) };
  const page = await records.query({ index: "ordinals", where, fields: ["ordinal"], limit: 5 });
  expect(page.records.map((row) => row.fields.ordinal)).toEqual([4950, 4900, 4850, 4800, 4750]);
  const statement = recordPageSql(
    index,
    ["ordinal"],
    sql`${recordScopeSql(await readQueryOwner(f.db, owner), index)} AND ${predicateSql(index, where)}`,
    5,
    0,
    undefined,
    await readQueryOwner(f.db, owner),
    where,
  );
  const evidence = JSON.stringify((await f.db.execute(sql`EXPLAIN (ANALYZE, FORMAT JSON) ${statement}`)).rows);
  expect(evidence).toContain("storage_query_");
  expect(evidence).not.toContain("Seq Scan");
  expect(evidence).toContain('"Rows Removed by Filter":0');
  // Larger owners choose a full scan when the estimate is far above the 100 matches.
  const estimate = await f.db.execute<{ "QUERY PLAN": string }>(
    sql`EXPLAIN SELECT count(*) FROM storage_current_records WHERE ${recordScopeSql(await readQueryOwner(f.db, owner), index)} AND ${predicateSql(index, where)}`,
  );
  const rows = Math.max(...estimate.rows.map((row) => Number(/rows=(\d+)/.exec(row["QUERY PLAN"])?.[1] ?? 0)));
  expect(rows).toBeLessThan(500);
});

test("ordered pages accept an in-list that fits the database parameter limit", async () => {
  const { records } = await fixture();
  await records.defineIndexes([
    {
      name: "groups",
      fields: { group: { path: ["group"], type: "string" }, rank: { path: ["rank"], type: "number" } },
      equality: ["group"],
      orderBy: [{ field: "rank", direction: "asc" }],
    },
  ]);
  await records.commit({ operationId: "seed", edits: [{ recordId: "match", replace: { group: "visible", rank: 1 } }] });
  const page = await records.query({
    index: "groups",
    where: { field: "group", op: "in", value: [...Array<string>(22_000).fill("other"), "visible"] },
    limit: 2,
  });
  expect(page.records.map((row) => row.recordId)).toEqual(["match"]);
});

test("in-list pages merge duplicate and null selections with filters, offsets and cursors", async () => {
  const f = await fixture();
  const memory = createMemoryStorage({ workbenchId: f.owner.workbenchId, extensionId: f.owner.extensionId }).records;
  for (const equality of [["group"], ["group", "category"]]) {
    for (const records of [f.records, memory]) {
      await records.defineIndexes([
        {
          name: "groups",
          fields: {
            group: { path: ["group"], type: "string" },
            category: { path: ["category"], type: "string" },
            rank: { path: ["rank"], type: "number" },
          },
          equality,
          orderBy: [{ field: "rank", direction: "desc" }],
        },
      ]);
      await records.commit({
        operationId: `seed-groups-${equality.length}`,
        edits: Array.from({ length: 30 }, (_, n) => ({
          recordId: `item-${n}`,
          replace: { group: ["a", "b", null][n % 3], category: n % 2 ? "visible" : "other", rank: n % 5 },
        })),
      });
    }
    const where: StoragePredicate = {
      all: [
        { field: "group", op: "in", value: ["a", null, "b", "a", "missing"] },
        { field: "category", op: "eq", value: "visible" },
      ],
    };
    const query = { index: "groups", where, limit: 3 };
    const ids = (page: Awaited<ReturnType<typeof memory.query>>) => page.records.map((row) => row.recordId);
    expect(ids(await f.records.query({ ...query, offset: 4 }))).toEqual(
      ids(await memory.query({ ...query, offset: 4 })),
    );
    const expected: string[] = [];
    const actual: string[] = [];
    for (const [records, result] of [
      [memory, expected],
      [f.records, actual],
    ] as const) {
      let cursor: string | undefined;
      do {
        const page = await records.query({ ...query, cursor });
        result.push(...ids(page));
        cursor = page.cursor ?? undefined;
      } while (cursor);
    }
    expect(actual).toEqual(expected);
    expect(new Set(actual).size).toBe(15);
  }
});

test("database and memory agree on null groups and object-only field paths", async () => {
  const f = await fixture();
  const memory = createMemoryStorage({ workbenchId: f.owner.workbenchId, extensionId: f.owner.extensionId }).records;
  const outputs = [];
  for (const records of [f.records, memory]) {
    await records.defineIndexes([
      {
        name: "values",
        fields: {
          active: { path: ["active"], type: "boolean" },
          first: { path: ["tags", "0"], type: "string" },
        },
      },
    ]);
    await records.commit({
      operationId: "group-values",
      edits: [null, false, true].map((active, index) => ({
        recordId: String(index),
        replace: { active, tags: ["first"] },
      })),
    });
    const groups = await records.aggregate({ index: "values", groupBy: "active" });
    const page = await records.query({ index: "values" });
    outputs.push({ groups: groups.groups, fields: page.records.map((row) => row.fields) });
  }
  expect(outputs[0]).toEqual(outputs[1]);
});

test("projection preserves strings and object keys outside PostgreSQL text", async () => {
  const f = await fixture();
  const value = { body: "a\u0000b", "\u0000key": "retained" };
  await f.records.commit({ operationId: "zero-byte", edits: [{ recordId: "note", replace: value }] });
  expect((await f.records.readMany(["note"]))[0].value).toEqual(value);
  await f.records.defineIndexes([
    {
      name: "body",
      fields: { body: { path: ["body"], type: "string" }, key: { path: ["\u0000key"], type: "string" } },
      equality: ["body"],
      orderBy: [{ field: "body", direction: "asc" }],
    },
  ]);
  const selected = await f.records.query({ index: "body", where: { field: "body", op: "eq", value: value.body } });
  expect(selected.records[0].fields).toEqual({ body: value.body, key: "retained" });
  expect(
    (await f.records.query({ index: "body", where: { field: "body", op: "contains", value: "\u0000B" } })).records,
  ).toHaveLength(1);
});

test("ordered SQL and public SDK queries preserve UTF-16 values and opaque revisions after a cold reopen", async () => {
  const f = await fixture();
  const memory = createMemoryStorage({ workbenchId: f.owner.workbenchId, extensionId: f.owner.extensionId }).records;
  const index: StorageRecordIndex = {
    name: "text",
    fields: { body: { path: ["body"], type: "string" } },
    equality: ["body"],
  };
  const group = {
    operationId: "preserve-text",
    edits: [{ recordId: "note", replace: { body: "x\ud800y", "\udc00key": ["\u0000", "😀", "\ud800"] } }],
  };
  for (const records of [f.records, memory]) {
    await records.defineIndexes([index]);
    await records.commit(group);
  }
  const reopened = createDocumentStorageDBService(f.db).open({ owner: f.owner }).records;
  const authoritative = await reopened.list();
  expect(await f.records.readMany(["note"])).toEqual(authoritative);
  expect(await reopened.readMany(["note"])).toEqual(authoritative);
  const [memoryRecord] = await memory.readMany(["note"]);
  // Lifetimes and revisions are opaque observations; equality/difference is not a Yjs author identity contract.
  expect(authoritative[0].recordLifetime).toEqual(expect.any(String));
  expect(memoryRecord).toMatchObject({
    recordId: "note",
    exists: true,
    deleted: false,
    value: group.edits[0].replace,
    asset: null,
    shared: null,
  });
  expect(memoryRecord.revision).toEqual(expect.any(String));
  expect((await memory.read("note")).revision).toBe(memoryRecord.revision);
  expect(authoritative[0].value).toEqual(group.edits[0].replace);
  const page = await reopened.query({
    index: "text",
    where: { field: "body", op: "eq", value: group.edits[0].replace.body },
  });
  const memoryPage = await memory.query({
    index: "text",
    where: { field: "body", op: "eq", value: group.edits[0].replace.body },
  });
  expect(page.records[0].revision).toBe(authoritative[0].revision);
  expect(memoryPage.records[0].revision).toBe(memoryRecord.revision);
});

test("Unicode predicates, wrapped arrays and reserved object keys match memory", async () => {
  const f = await fixture();
  const memory = createMemoryStorage({ workbenchId: f.owner.workbenchId, extensionId: f.owner.extensionId }).records;
  const values = ["ÉİẞΣ", "😀", "\ud800", "a\u0000b", "slash\\123", "ascii", "\uE000", "\u0001s"];
  const outputs = [];
  for (const records of [f.records, memory]) {
    await records.defineIndexes([
      {
        name: "text",
        fields: {
          body: { path: ["body"], type: "string" },
          tags: { path: ["tags"], type: "array" },
          "\u0001s": { path: ["\u0001s"], type: "string" },
        },
        equality: ["body"],
        orderBy: [{ field: "body", direction: "asc" }],
      },
    ]);
    await records.commit({
      operationId: "unicode-records",
      edits: values.map((body, index) => ({
        recordId: String(index),
        replace: { body, tags: [body], "\u0001s": body, nested: { "\u0001s": "literal tag" } },
      })),
    });
    const filters = [];
    for (const value of ["i\u0307", "ς", "\ud83d", "\ude00", "\u0000B", "\\123", "\u0001s", ""]) {
      const page = await records.query({ index: "text", where: { field: "body", op: "contains", value } });
      filters.push(page.records.map((row) => row.recordId));
    }
    const page = await records.query({ index: "text", limit: 3 });
    const next = await records.query({ index: "text", limit: 3, cursor: page.cursor! });
    const tag = await records.query({ index: "text", where: { field: "tags", op: "contains", value: "😀" } });
    const groups = await records.aggregate({ index: "text", groupBy: "tags" });
    const batch = await records.readMany(values.map((_, index) => String(index)));
    const comparable = (rows: typeof page.records) =>
      rows.map(({ revision, ...row }) => {
        expect(revision).toBe(batch.find((record) => record.recordId === row.recordId)!.revision);
        return row;
      });
    outputs.push({
      filters,
      page: comparable(page.records),
      next: comparable(next.records),
      tag: comparable(tag.records),
      groups: groups.groups,
      values: batch.map((record) => record.value),
    });
  }
  expect(outputs[0]).toEqual(outputs[1]);
  expect(outputs[0].filters[2]).toEqual(["1"]);
  expect(outputs[0].filters[3]).toEqual(["1"]);
});

test("memory and database queries select a 500-row page", async () => {
  const f = await fixture();
  const memory = createMemoryStorage({ workbenchId: f.owner.workbenchId, extensionId: f.owner.extensionId }).records;
  const index: StorageRecordIndex = {
    name: "bulk",
    fields: { rank: { path: ["rank"], type: "number" } },
    orderBy: [{ field: "rank", direction: "asc" }],
  };
  for (const records of [f.records, memory]) {
    await records.defineIndexes([index]);
    await records.commit({
      operationId: "seed-bulk",
      edits: Array.from({ length: 501 }, (_, rank) => ({ recordId: `item-${rank}`, replace: { rank } })),
    });
    const first = await records.query({ index: "bulk", limit: 500, fields: ["rank"] });
    expect(first.records).toHaveLength(500);
    expect(first.cursor).not.toBeNull();
    const last = await records.query({ index: "bulk", limit: 500, fields: ["rank"], cursor: first.cursor! });
    expect(last.records.map((record) => record.fields.rank)).toEqual([500]);
  }
});

test("revision-only queries validate fields and cursors without selecting resource rows", async () => {
  const f = await fixture();
  const memory = createMemoryStorage({ workbenchId: f.owner.workbenchId, extensionId: f.owner.extensionId }).records;
  for (const records of [f.records, memory]) {
    await records.defineIndexes([{ name: "items", fields: { title: { path: ["title"], type: "string" } } }]);
    await records.commit({
      operationId: "seed",
      edits: ["one", "two"].map((recordId) => ({ recordId, replace: { title: recordId } })),
    });
    const first = await records.query({ index: "items", fields: ["title"], limit: 1 });
    const checked = await records.query({ index: "items", fields: ["title"], limit: 0, cursor: first.cursor! });
    expect(checked).toEqual({ revision: first.revision, records: [], cursor: null });
    await expect(records.query({ index: "items", fields: ["missing"], limit: 0 })).rejects.toThrow();
    await expect(records.query({ index: "items", limit: 0, cursor: "invalid" })).rejects.toThrow("cursor");
    await records.commit({ operationId: "change", edits: [{ recordId: "one", set: { "/title": "Changed" } }] });
    await expect(records.query({ index: "items", limit: 0, revision: first.revision })).rejects.toThrow("stale");
  }
});

test("unfiltered record-ID pages stay bounded within an equality-indexed prefix", async () => {
  const f = await fixture();
  const index: StorageRecordIndex = {
    name: "prefixed-status",
    prefix: "z/",
    fields: { status: { path: ["status"], type: "string" } },
    equality: ["status"],
  };
  await f.records.defineIndexes([index]);
  await f.records.commit({
    operationId: "seed-prefixed-id-page",
    edits: [
      ...Array.from({ length: 1_000 }, (_, n) => ({
        recordId: `a/${String(n).padStart(4, "0")}`,
        replace: { status: "other" },
      })),
      ...Array.from({ length: 30 }, (_, n) => ({
        recordId: `z/${String(n).padStart(4, "0")}`,
        replace: { status: n % 2 ? "open" : "closed" },
      })),
    ],
  });
  await f.db.execute(sql`ANALYZE storage_current_records`);
  const page = await f.records.query({ index: index.name, limit: 3 });
  expect(page.records.map(({ recordId }) => recordId)).toEqual(["z/0000", "z/0001", "z/0002"]);
  const result = await f.db.execute(
    sql`EXPLAIN (ANALYZE, FORMAT JSON) ${recordPageSql(index, ["status"], recordScopeSql(await readQueryOwner(f.db, f.owner), index), 4, 0, undefined, await readQueryOwner(f.db, f.owner))}`,
  );
  const plan = JSON.stringify(result.rows);
  const scans: number[] = [];
  const visit = (node: Record<string, unknown>) => {
    if (String(node["Node Type"]).includes("Scan"))
      scans.push(
        Number(node["Actual Rows"]) * Number(node["Actual Loops"]) + Number(node["Rows Removed by Filter"] ?? 0),
      );
    for (const child of (node.Plans ?? []) as Record<string, unknown>[]) visit(child);
  };
  visit(JSON.parse(plan)[0]["QUERY PLAN"][0].Plan);
  expect(scans.length).toBeGreaterThan(0);
  expect(Math.max(...scans)).toBeLessThanOrEqual(4);
  expect(plan).not.toContain("Seq Scan");
});

test("a small ordered page probes each leading equality value even with a competing sort index", async () => {
  const f = await fixture();
  const index: StorageRecordIndex = {
    name: "byGroup",
    prefix: "row-",
    fields: { group: { path: ["group"], type: "string" }, rank: { path: ["rank"], type: "string" } },
    equality: ["group"],
    orderBy: [{ field: "rank", direction: "asc" }],
  };
  await f.records.defineIndexes([index, { ...index, name: "byRank", equality: [] }]);
  await f.db.execute(sql`insert into storage_current_records (owner_id,record_id,deleted,value,revision)
    select ${storageOwnerKey(f.owner)},'row-'||n,false,jsonb_build_object('group',case n when 1999 then null when 2000 then '' else 'present' end,'rank',lpad(n::text,4,'0')),'1' from generate_series(1,2000) n`);
  // Other collections in the same table make null look common to the planner.
  await f.db.execute(sql`insert into storage_current_records (owner_id,record_id,deleted,value,revision)
    select ${storageOwnerKey(f.owner)},'other-'||n,false,'{}'::jsonb,'1' from generate_series(1,4000) n`);
  await f.db.execute(sql`analyze storage_current_records`);
  const where = { field: "group", op: "in" as const, value: [null, "", null] };
  const first = await f.records.query({ index: index.name, where, limit: 1 });
  expect(first.records.map((r) => r.recordId)).toEqual(["row-1999"]);
  expect(
    (await f.records.query({ index: index.name, where, limit: 1, cursor: first.cursor! })).records.map(
      (r) => r.recordId,
    ),
  ).toEqual(["row-2000"]);
  expect(
    (await f.records.query({ index: index.name, where, limit: 1, offset: 1 })).records.map((r) => r.recordId),
  ).toEqual(["row-2000"]);
  const missing = { field: "group", op: "in" as const, value: ["absent", "unassigned"] };
  const scope = recordScopeSql(await readQueryOwner(f.db, f.owner), index);
  const stmt = recordPageSql(
    index,
    ["rank"],
    sql`${scope} AND ${predicateSql(index, missing)}`,
    2,
    0,
    undefined,
    f.owner,
    missing,
  );
  const plan = (await f.db.execute(sql`explain(analyze,format json) ${stmt}`)).rows;
  const evidence = JSON.stringify(plan);
  expect(evidence).toContain('"Node Type":"Nested Loop"');
  expect(evidence).not.toContain('"Node Type":"Seq Scan"');
  // Exact index probes skip unrelated records when the keys are absent.
  expect([...evidence.matchAll(/"Rows Removed by Filter":(\d+)/g)].every(([, rows]) => Number(rows) <= 1)).toBe(true);
});

test("an indexed boolean keeps a small ordered page bounded with a competing equality index", async () => {
  const f = await fixture();
  const index: StorageRecordIndex = {
    name: "published-order",
    prefix: "item-",
    fields: {
      published: { path: ["published"], type: "boolean" },
      rank: { path: ["rank"], type: "string" },
      id: { path: ["id"], type: "string" },
    },
    equality: ["published"],
    orderBy: [
      { field: "rank", direction: "desc" },
      { field: "id", direction: "desc" },
    ],
  };
  await f.records.defineIndexes([index, { ...index, name: "published", orderBy: [] }]);
  await f.records.commit({
    operationId: "boolean-pages",
    edits: [
      ...Array.from({ length: 2000 }, (_, i) => ({
        recordId: `item-${i}`,
        replace: { published: i >= 100, rank: `${i.toString().padStart(5, "0")}${"x".repeat(120)}`, id: i.toString() },
      })),
      ...Array.from({ length: 6000 }, (_, i) => ({ recordId: `other-${i}`, replace: { kind: "other" } })),
      { recordId: "item-null", replace: { published: null, rank: "empty" } },
      { recordId: "item-missing", replace: { rank: "absent" } },
      { recordId: "item-invalid", replace: { published: "true", rank: "invalid" } },
    ],
  });
  await f.db.execute(sql`ANALYZE storage_current_records`);
  const where = { field: "published", op: "eq", value: true } as const;
  const page = (value: boolean | null) => f.records.query({ index: index.name, where: { ...where, value }, limit: 3 });
  expect((await page(true)).records.map((r) => r.recordId)).toEqual(["item-1999", "item-1998", "item-1997"]);
  expect((await page(false)).records.map((r) => r.recordId)).toEqual(["item-99", "item-98", "item-97"]);
  expect((await page(null)).records.map((r) => r.recordId)).toEqual(["item-invalid", "item-null", "item-missing"]);
  const query = recordPageSql(
    index,
    ["rank"],
    sql`${recordScopeSql(await readQueryOwner(f.db, f.owner), index)} AND ${predicateSql(index, where)}`,
    2,
  );
  const plan = await f.db.execute(sql`EXPLAIN (ANALYZE, FORMAT JSON) ${query}`);
  const json = JSON.stringify(plan.rows);
  expect(json).toContain('"Node Type":"Index Scan"');
  const rows = [...json.matchAll(/"(?:Actual Rows|Rows Removed by Filter)":(\d+)/g)].map((match) => Number(match[1]));
  expect(Math.max(...rows)).toBeLessThan(10);
});
