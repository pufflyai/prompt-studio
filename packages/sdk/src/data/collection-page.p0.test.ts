import { expect, test } from "bun:test";
import { createMemoryStorage } from "../testing/memory-storage";
import { readCollectionPage } from "./collection-page";

const fixture = async () => {
  const storage = createMemoryStorage();
  await storage.records.defineIndexes([
    {
      name: "foobar",
      collection: "foobar",
      fields: {
        title: { path: ["title"], type: "string" },
        rank: { path: ["rank"], type: "number" },
        state: { path: ["state"], type: "string" },
      },
      orderBy: [{ field: "rank", direction: "asc" }],
    },
  ]);
  for (let rank = 0; rank < 240; rank++)
    await storage.collection("foobar").put(String(rank), {
      rank,
      state: rank < 120 ? "ready" : "done",
      title: rank >= 200 ? "Late match" : "Other",
    });
  return storage;
};

test("collection pages default to 100 projections and retain global totals and groups", async () => {
  const storage = await fixture();
  const first = await readCollectionPage(storage, {
    index: "foobar",
    fields: ["rank"],
    groups: [{ field: "status", indexField: "state" }],
  });
  expect(first.records).toHaveLength(100);
  expect(first.records[0].fields).toEqual({ rank: 0 });
  expect(first.page.total).toBe(240);
  expect(first.page.filteredTotal).toBe(240);
  expect(first.page.groups).toEqual([
    { field: "status", value: "done", count: 120 },
    { field: "status", value: "ready", count: 120 },
  ]);
  const last = await readCollectionPage(storage, {
    index: "foobar",
    fields: ["rank"],
    search: { field: "title", op: "contains", value: "match" },
    orderBy: [{ field: "rank", direction: "desc" }],
    page: { limit: 10, offset: 0, search: "match", fields: ["rank"] },
  });
  expect(last.records.map((record) => record.fields.rank)).toEqual([239, 238, 237, 236, 235, 234, 233, 232, 231, 230]);
  expect(last.page.total).toBe(240);
  expect(last.page.filteredTotal).toBe(40);
});

test("continuations and direct jumps retain the selection revision", async () => {
  const storage = await fixture();
  const first = await readCollectionPage(storage, { index: "foobar", fields: ["rank"] });
  const second = await readCollectionPage(storage, {
    index: "foobar",
    fields: ["rank"],
    page: {
      limit: 100,
      offset: 0,
      cursor: first.page.cursor!,
      revision: first.page.revision,
      fields: ["rank"],
      search: "",
    },
  });
  expect(second.records[0].fields.rank).toBe(100);
  await storage.collection("foobar").put("new", { rank: 999 });
  await expect(
    readCollectionPage(storage, {
      index: "foobar",
      page: { limit: 100, offset: 200, revision: first.page.revision, fields: [], search: "" },
    }),
  ).rejects.toThrow("stale");
});

test("changing data between counts and rows fails instead of returning mixed revisions", async () => {
  const storage = await fixture();
  const aggregate = storage.records.aggregate;
  storage.records.aggregate = async (input) => {
    const result = await aggregate(input);
    await storage.collection("foobar").put("new", { rank: 999 });
    return result;
  };
  await expect(readCollectionPage(storage, { index: "foobar" })).rejects.toThrow("stale");
});

test("search and collapsed groups need explicit bounded selection predicates", async () => {
  const storage = await fixture();
  await expect(
    readCollectionPage(storage, {
      index: "foobar",
      page: { limit: 100, offset: 0, fields: [], search: "untranslated" },
    }),
  ).rejects.toThrow("search predicate");
  await expect(
    readCollectionPage(storage, {
      index: "foobar",
      page: { limit: 100, offset: 0, fields: [], search: "", collapsedGroups: ["ready"] },
    }),
  ).rejects.toThrow("collapsed-group predicate");
  const result = await readCollectionPage(storage, {
    index: "foobar",
    fields: ["rank"],
    visible: { field: "state", op: "ne", value: "ready" },
    page: { limit: 10, offset: 0, fields: [], search: "", collapsedGroups: ["ready"] },
  });
  expect(result.page.total).toBe(240);
  expect(result.page.filteredTotal).toBe(120);
  expect(result.records[0].fields.rank).toBe(120);
});

test("two-level group summaries retain the filter and search before excluding collapsed rows", async () => {
  const storage = await fixture();
  const result = await readCollectionPage(storage, {
    index: "foobar",
    fields: ["rank"],
    where: { field: "rank", op: "gte", value: 100 },
    search: { field: "title", op: "equalsIgnoreCase", value: "other" },
    visible: { field: "state", op: "ne", value: "done" },
    groups: [
      { field: "status", indexField: "state" },
      { field: "name", indexField: "title" },
    ],
  });
  expect(result.page.total).toBe(140);
  expect(result.page.filteredTotal).toBe(20);
  expect(result.records).toHaveLength(20);
  expect(result.page.groups).toEqual([
    { field: "status", value: "done", count: 80 },
    { field: "status", value: "ready", count: 20 },
    { field: "name", value: "Other", count: 80, parent: { field: "status", value: "done" } },
    { field: "name", value: "Other", count: 20, parent: { field: "status", value: "ready" } },
  ]);
});

test("equivalent JSON parent groups combine across different child values", async () => {
  const storage = createMemoryStorage();
  await storage.records.defineIndexes([
    {
      name: "items",
      collection: "items",
      fields: {
        parent: { path: ["parent"], type: "object" },
        child: { path: ["child"], type: "string" },
      },
    },
  ]);
  await storage.collection("items").put("a", { parent: { a: 1, b: 2 }, child: "first" });
  await storage.collection("items").put("b", { parent: { b: 2, a: 1 }, child: "second" });
  const result = await readCollectionPage(storage, {
    index: "items",
    groups: [
      { field: "parent", indexField: "parent" },
      { field: "child", indexField: "child" },
    ],
  });
  expect(result.page.groups.filter((group) => !group.parent)).toEqual([
    { field: "parent", value: { a: 1, b: 2 }, count: 2 },
  ]);
});

test("rebinding an index between counts and rows rejects the mixed selection", async () => {
  const storage = createMemoryStorage();
  const definition = { name: "items", collection: "a", fields: { rank: { path: ["rank"], type: "number" as const } } };
  await storage.records.defineIndexes([definition]);
  await storage.collection("a").put("one", { rank: 1 });
  await storage.collection("a").put("two", { rank: 2 });
  await storage.collection("b").put("other", { rank: 3 });
  const aggregate = storage.records.aggregate;
  storage.records.aggregate = async (input) => {
    const result = await aggregate(input);
    await storage.records.defineIndexes([{ ...definition, collection: "b" }]);
    return result;
  };
  await expect(readCollectionPage(storage, { index: "items" })).rejects.toThrow("stale");
});
