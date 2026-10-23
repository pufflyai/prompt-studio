import { afterEach, expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { createDocumentStorage, createMemoryDocumentStore } from "pstdio-sync";
import type { Json, StoragePredicate, StorageRecordIndex } from "pstdio-sync-contracts";
import { storage_record_projections } from "../../db/schemas.pg";
import { createProjectsDBService } from "../projects/projects";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";
import { predicateSql, recordPageSql, recordScopeSql } from "./record-query-sql";

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
  const memory = createDocumentStorage({ owner: f.owner, store: createMemoryDocumentStore() }).records;
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
  const memory = createDocumentStorage({ owner: f.owner, store: createMemoryDocumentStore() }).records;
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
  const memory = createDocumentStorage({ owner: f.owner, store: createMemoryDocumentStore() }).records;
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

test("upgraded owners without declared indexes receive the batch-read projection once", async () => {
  const f = await fixture();
  await f.records.commit({ operationId: "old", edits: [{ recordId: "note", replace: "existing" }] });
  await f.db.delete(storage_record_projections).where(eq(storage_record_projections.workbench_id, f.projectAId));
  const reopened = createDocumentStorageDBService(f.db).open({ owner: f.owner }).records;
  await reopened.defineIndexes([]);
  expect((await reopened.readMany(["note"]))[0].value).toBe("existing");
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

test("deleting a project removes its physical query indexes", async () => {
  const f = await fixture();
  await f.records.defineIndexes([{ name: "notes", fields: { title: { path: ["title"], type: "string" } } }]);
  const physical = async () =>
    (await f.db.execute(sql`SELECT indexname FROM pg_indexes WHERE indexname LIKE 'storage_query_%'`)).rows;
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
    sql`${recordScopeSql(f.owner, index)} AND ${predicateSql(index, { field: "status", op: "eq", value: "ready" })}`,
    5,
  );
  const plan = await f.db.execute(sql`EXPLAIN (ANALYZE, FORMAT JSON) ${statement}`);
  const evidence = JSON.stringify(plan.rows);
  expect(evidence).toContain("storage_query_");
  expect(evidence).toContain("Index Scan");
  expect(evidence).not.toContain("Seq Scan");
  expect(evidence).toContain('"Rows Removed by Filter":0');
});

test("database and memory agree on null groups and object-only field paths", async () => {
  const f = await fixture();
  const memory = createDocumentStorage({ owner: f.owner, store: createMemoryDocumentStore() }).records;
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

test("indexed values and revisions match the authoritative document after a cold reopen", async () => {
  const f = await fixture();
  const memory = createDocumentStorage({ owner: f.owner, store: createMemoryDocumentStore() }).records;
  const index: StorageRecordIndex = {
    name: "text",
    fields: { body: { path: ["body"], type: "string" } },
    equality: ["body"],
  };
  const group = {
    operationId: "normalize-text",
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
  expect(await memory.readMany(["note"])).toEqual(authoritative);
  expect(authoritative[0].value).toEqual({ body: "x�y", "�key": ["\u0000", "😀", "�"] });
  const page = await reopened.query({ index: "text", where: { field: "body", op: "eq", value: "x�y" } });
  expect(page.records[0].revision).toBe(authoritative[0].revision);
});

test("Unicode predicates, wrapped arrays and reserved object keys match memory", async () => {
  const f = await fixture();
  const memory = createDocumentStorage({ owner: f.owner, store: createMemoryDocumentStore() }).records;
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
    outputs.push({
      filters,
      page: page.records,
      next: next.records,
      tag: tag.records,
      groups: groups.groups,
      values: batch.map((record) => record.value),
    });
  }
  expect(outputs[0]).toEqual(outputs[1]);
  expect(outputs[0].filters[2]).toEqual(["1"]);
  expect(outputs[0].filters[3]).toEqual(["1"]);
});
