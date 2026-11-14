import { afterEach, expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import type { StoragePredicate, StorageRecordIndex } from "pstdio-sync-contracts";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
const definitions: StorageRecordIndex[] = [
  {
    name: "items",
    prefix: "items/",
    fields: {
      id: { path: ["id"], type: "string" },
      title: { path: ["title"], type: "string" },
      rank: { path: ["rank"], type: "number" },
      status: { path: ["status"], type: "string" },
      points: { path: ["points"], type: "number" },
      tags: { path: ["tags"], type: "array" },
    },
    orderBy: [{ field: "rank", direction: "asc" }],
  },
  {
    name: "requests",
    prefix: "requests/",
    fields: { id: { path: ["id"], type: "string" }, item: { path: ["item"], type: "string" } },
    equality: ["item"],
  },
  {
    name: "answers",
    prefix: "answers/",
    fields: { request: { path: ["request"], type: "string" } },
    equality: ["request"],
  },
];
const fixture = async () => {
  const f = await createExtensionStorageFixture();
  cleanup.push(f.close);
  const service = createDocumentStorageDBService(f.db);
  const owner = { workbenchId: f.projectAId, extensionId: "ext.example" };
  return {
    db: service.open({ owner }).records,
    memory: createMemoryStorage(owner).records,
    foreign: service.open({ owner: { ...owner, extensionId: "ext.foreign" } }).records,
  };
};

test("requested sort selects globally before limiting and cursors retain the full requested order", async () => {
  const f = await fixture();
  for (const records of [f.db, f.memory]) {
    await records.defineIndexes(definitions);
    await records.commit({
      operationId: "seed",
      edits: Array.from({ length: 240 }, (_, i) => ({
        recordId: `items/${String(i).padStart(3, "0")}`,
        replace: { id: String(i), title: i % 2 ? "B" : "A", rank: i },
      })),
    });
    const request = {
      index: "items",
      fields: ["rank"],
      limit: 2,
      orderBy: [
        { field: "title", direction: "asc" as const },
        { field: "rank", direction: "desc" as const },
      ],
    };
    const first = await records.query(request);
    expect(first.records.map((r) => r.fields.rank)).toEqual([238, 236]);
    const next = await records.query({ ...request, cursor: first.cursor! });
    expect(next.records.map((r) => r.fields.rank)).toEqual([234, 232]);
    await expect(records.query({ ...request, orderBy: [], cursor: first.cursor! })).rejects.toThrow("stale");
    await expect(records.query({ ...request, orderBy: [{ field: "tags", direction: "asc" }] })).rejects.toThrow(
      "order",
    );
  }
});

test("related existence is scoped, distinct and composable with nested absence before paging", async () => {
  const f = await fixture();
  await f.foreign.defineIndexes(definitions);
  await f.foreign.commit({
    operationId: "foreign",
    edits: [
      { recordId: "answers/foreign", replace: { request: "r2" } },
      { recordId: "requests/foreign", replace: { id: "foreign", item: "c" } },
    ],
  });
  for (const records of [f.db, f.memory]) {
    await records.defineIndexes(definitions);
    await records.commit({
      operationId: "seed",
      edits: [
        ...["a", "b", "c"].map((id) => ({ recordId: `items/${id}`, replace: { id, rank: 1 } })),
        { recordId: "requests/one", replace: { id: "r1", item: "a" } },
        { recordId: "requests/two", replace: { id: "r2", item: "b" } },
        { recordId: "requests/three", replace: { id: "r3", item: "b" } },
        { recordId: "answers/one", replace: { request: "r1" } },
      ],
    });
    const where: StoragePredicate = {
      exists: {
        index: "requests",
        on: [{ sourceField: "id", relatedField: "item" }],
        where: { not: { exists: { index: "answers", on: [{ sourceField: "id", relatedField: "request" }] } } },
      },
    };
    const page = await records.query({ index: "items", where, fields: ["id"], limit: 1 });
    expect(page.records.map((r) => r.fields.id)).toEqual(["b"]);
    expect(page.cursor).toBeNull();
    expect((await records.aggregate({ index: "items", where })).count).toBe(1);
    expect(
      (await records.query({ index: "items", where: { not: where }, fields: ["id"] })).records.map((r) => r.fields.id),
    ).toEqual(["a", "c"]);
    await records.commit({ operationId: "answer", edits: [{ recordId: "answers/two", replace: { request: "r2" } }] });
    expect((await records.aggregate({ index: "items", where })).count).toBe(1);
    await expect(
      records.query({
        index: "items",
        where: { exists: { index: "missing", on: [{ sourceField: "id", relatedField: "id" }] } },
      }),
    ).rejects.toThrow("index");
  }
});

test("related membership selects prerequisites and dependents before pagination", async () => {
  const f = await fixture();
  for (const records of [f.db, f.memory]) {
    await records.defineIndexes(definitions);
    await records.commit({
      operationId: "seed",
      edits: [
        { recordId: "items/a", replace: { id: "a", status: "ready" } },
        { recordId: "items/b", replace: { id: "b", status: "ready", tags: ["a", "missing"] } },
        { recordId: "items/c", replace: { id: "c", status: "ready", tags: ["d"] } },
        { recordId: "items/d", replace: { id: "d", status: "done", tags: [] } },
      ],
    });
    const waiting = await records.query({
      index: "items",
      fields: ["id"],
      limit: 1,
      where: {
        exists: {
          index: "items",
          on: [{ sourceField: "tags", relatedField: "id", op: "contains" }],
          where: { field: "status", op: "ne", value: "done" },
        },
      },
    });
    expect(waiting.records.map((record) => record.fields.id)).toEqual(["b"]);
    expect(waiting.cursor).toBeNull();
    const prerequisites = await records.query({
      index: "items",
      fields: ["id"],
      where: {
        exists: {
          index: "items",
          on: [{ sourceField: "id", relatedField: "tags", op: "containedBy" }],
          where: { field: "status", op: "ne", value: "done" },
        },
      },
    });
    expect(prerequisites.records.map((record) => record.fields.id)).toEqual(["a", "d"]);
  }
});

test("numeric and grouped summaries cover the whole selection and preserve null semantics", async () => {
  const f = await fixture();
  for (const records of [f.db, f.memory]) {
    await records.defineIndexes(definitions);
    await records.commit({
      operationId: "seed",
      edits: [
        { recordId: "items/a", replace: { status: "done", title: "A", points: 3, rank: 10 } },
        { recordId: "items/b", replace: { status: "done", title: "A", points: 5, rank: 20 } },
        { recordId: "items/c", replace: { status: "done", title: "B", points: "invalid", rank: null } },
        { recordId: "items/d", replace: { status: "ready", title: "A", points: 1000, rank: 1 } },
      ],
    });
    const query = {
      index: "items",
      where: { field: "status", op: "eq" as const, value: "done" },
      metrics: {
        points: { operation: "sum" as const, field: "points" },
        first: { operation: "min" as const, field: "rank" },
        last: { operation: "max" as const, field: "rank" },
      },
    };
    const all = await records.aggregate(query);
    expect(all.count).toBe(3);
    expect(all.metrics).toEqual({ points: 8, first: 10, last: 20 });
    const grouped = await records.aggregate({ ...query, groupBy: ["status", "title"] });
    expect(grouped.groups).toEqual([
      { value: ["done", "A"], count: 2, metrics: { points: 8, first: 10, last: 20 } },
      { value: ["done", "B"], count: 1, metrics: { points: 0, first: null, last: null } },
    ]);
    const empty = await records.aggregate({ ...query, where: { field: "status", op: "eq", value: "absent" } });
    expect(empty.metrics).toEqual({ points: 0, first: null, last: null });
    await expect(
      records.aggregate({ index: "items", metrics: { invalid: { operation: "sum", field: "title" } } }),
    ).rejects.toThrow("number");
  }
});

test("relationship cursors reject a changed related definition and missing keys never form links", async () => {
  const f = await fixture();
  for (const records of [f.db, f.memory]) {
    await records.defineIndexes(definitions);
    await records.commit({
      operationId: "seed",
      edits: [
        { recordId: "items/a", replace: { id: "a" } },
        { recordId: "items/b", replace: { id: "b" } },
        { recordId: "items/missing", replace: {} },
        { recordId: "requests/a", replace: { item: "a" } },
        { recordId: "requests/b", replace: { item: "b" } },
        { recordId: "requests/missing", replace: {} },
      ],
    });
    const where: StoragePredicate = {
      exists: { index: "requests", on: [{ sourceField: "id", relatedField: "item" }] },
    };
    const page = await records.query({ index: "items", where, limit: 1 });
    expect(page.records.map((row) => row.recordId)).toEqual(["items/a"]);
    expect((await records.aggregate({ index: "items", where })).count).toBe(2);
    await records.defineIndexes([...definitions].reverse());
    expect((await records.aggregate({ index: "items" })).revision).toBe(page.revision);
    await records.defineIndexes(
      definitions.map((index) =>
        index.name !== "requests"
          ? index
          : {
              ...index,
              fields: { ...index.fields, item: { path: ["replacement"], type: "string" } },
            },
      ),
    );
    await expect(records.query({ index: "items", where, limit: 1, cursor: page.cursor! })).rejects.toThrow("stale");
    await expect(records.query({ index: "items", revision: page.revision })).rejects.toThrow("stale");
    expect((await records.aggregate({ index: "items", where })).count).toBe(0);
  }
});

test("group limits fail visibly and multi-field numeric groups retain scalar order", async () => {
  const f = await fixture();
  for (const records of [f.db, f.memory]) {
    await records.defineIndexes(definitions);
    await records.commit({
      operationId: "seed",
      edits: [2, 10, 20].map((rank) => ({
        recordId: `items/${rank}`,
        replace: { status: "ready", rank, points: rank },
      })),
    });
    const query = {
      index: "items",
      groupBy: ["status", "rank"],
      metrics: { "total\u0000É": { operation: "sum" as const, field: "points" } },
    };
    const result = await records.aggregate(query);
    expect(result.groups.map((group) => group.value)).toEqual([
      ["ready", 2],
      ["ready", 10],
      ["ready", 20],
    ]);
    expect(result.metrics).toEqual({ "total\u0000É": 32 });
    await expect(records.aggregate({ ...query, groupLimit: 2 })).rejects.toThrow("more than 2 groups");
    await expect(records.aggregate({ ...query, groupLimit: 501 })).rejects.toThrow("limit");
    expect((await records.aggregate({ index: "items", groupBy: "rank" })).groups).toHaveLength(3);
  }
});

test("sums use saved decimal values and round once in both database and memory", async () => {
  const f = await fixture();
  for (const records of [f.db, f.memory]) {
    await records.defineIndexes(definitions);
    await records.commit({
      operationId: "seed",
      edits: [
        ...[0.1, 0.2].map((points, i) => ({
          recordId: `items/fraction-${i}`,
          replace: { status: "fractions", points },
        })),
        ...[1e16, 1, -1e16].map((points, i) => ({
          recordId: `items/cancellation-${i}`,
          replace: { status: "cancellation", points },
        })),
      ],
    });
    const result = await records.aggregate({
      index: "items",
      groupBy: "status",
      metrics: { total: { operation: "sum", field: "points" } },
    });
    expect(result.groups.map((group) => [group.value, group.metrics?.total])).toEqual([
      ["cancellation", 1],
      ["fractions", 0.3],
    ]);
    expect(result.metrics?.total).toBe(1.3);
    await records.commit({
      operationId: "overflow",
      edits: [
        { recordId: "items/large-a", replace: { points: 1e308 } },
        { recordId: "items/large-b", replace: { points: 1e308 } },
      ],
    });
    await expect(
      records.aggregate({ index: "items", metrics: { total: { operation: "sum", field: "points" } } }),
    ).rejects.toThrow("finite JavaScript range");
  }
});
