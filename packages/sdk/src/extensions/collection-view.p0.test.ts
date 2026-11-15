import { expect, test } from "bun:test";
import { makeCommandContext } from "../testing/command-context";
import { createMemoryStorage } from "../testing/memory-storage";
import { collectionTableQuery, collectionViewQuery } from "./collection-view";
import { defineView } from "./define-contribution";
import { defineExtension } from "./define-extension";

test("a new resource view installs its query projection and filters before its default bounded page", async () => {
  const query = collectionViewQuery({
    index: {
      name: "foobars",
      collection: "foobars",
      fields: {
        id: { path: ["id"], type: "string", derive: { kind: "collectionKey" } },
        title: { path: ["title"], type: "string" },
        state: { path: ["state"], type: "string" },
        body: { path: ["body"], type: "string" },
      },
    },
    attributes: [
      { id: "body", label: "Body", type: { kind: "string" } },
      {
        id: "state",
        label: "State",
        type: {
          kind: "enum",
          options: [
            { value: "late", label: "Late" },
            { value: "other", label: "Other" },
          ],
        },
        filterable: true,
      },
    ],
    resourceKind: "foobar",
  });
  const extension = defineExtension({
    views: [defineView({ id: "foobars", title: "Foobars", body: { kind: "kanban", query } })],
  });
  expect(extension.views[0].body.queryMode).toBe("paged");
  expect(extension.storageIndexes).toHaveLength(1);
  const ctx = makeCommandContext({ storage: createMemoryStorage(), params: {} });
  await ctx.storage.records.defineIndexes(extension.storageIndexes!);
  const items = ctx.storage.collection("foobars");
  for (let i = 0; i < 1503; i++)
    await items.put(String(i), {
      title: `Foobar ${i}`,
      state: i >= 1500 ? "late" : "other",
      body: "large".repeat(1000),
    });
  const collection = ctx.storage.collection.bind(ctx.storage);
  ctx.storage.collection = (name) => ({
    ...collection(name),
    list: async () => {
      throw new Error("Unbounded resource load");
    },
  });
  const result = await query(ctx, {
    rendererId: "foobars",
    filter: { conjunction: "and", rules: [{ attributeId: "state", condition: "is-any-of", value: ["late"] }] },
  } as never);
  expect(result.page?.total).toBe(3);
  expect(result.rows).toHaveLength(3);
  expect(result.rows[0].resource?.type).toBe("foobar");
  expect(JSON.stringify(result)).not.toContain("largelarge");
  const initial = await query(ctx, {} as never);
  expect(initial.rows).toHaveLength(100);
  expect(initial.page?.total).toBe(1503);
  expect(initial.page?.cursor).toBeString();
  expect(JSON.stringify(initial)).not.toContain("largelarge");
  const table = collectionTableQuery({
    index: extension.storageIndexes![0],
    resourceKind: "foobar",
    columns: [
      { id: "title", type: "string" },
      { id: "state", type: "string" },
    ],
  });
  const filtered = await table(ctx, {
    filter: { conjunction: "and", rules: [{ attributeId: "state", condition: "is", value: "late" }] },
    sorts: [],
    settings: { grouping: "state" },
  } as never);
  expect(filtered.rows).toHaveLength(3);
  expect(filtered.page?.groups).toEqual([{ field: "state", value: "late", count: 3 }]);
});

test("generated boolean query fields retain saved legacy value mappings", async () => {
  const index = {
    name: "items",
    collection: "items",
    fields: {
      id: { type: "string", derive: { kind: "collectionKey" } },
      title: { type: "string", path: ["title"] },
      archived: { type: "boolean", path: ["archived"] },
    },
  } as const;
  const query = collectionViewQuery({
    index: index as never,
    attributes: [
      { id: "archived", label: "Archived", type: { kind: "boolean", legacyValues: { active: false, archived: true } } },
    ],
  });
  const ctx = makeCommandContext({ storage: createMemoryStorage(), params: {} });
  await ctx.storage.records.defineIndexes([index as never]);
  await ctx.storage.collection("items").put("active", { title: "Active", archived: false });
  await ctx.storage.collection("items").put("archived", { title: "Archived", archived: true });
  const result = await query(ctx, {
    filter: { conjunction: "and", rules: [{ attributeId: "archived", condition: "is-any-of", value: ["active"] }] },
  } as never);
  expect(result.rows.map(({ id }) => id)).toEqual(["active"]);
});

test("default resource providers use viewer labels and exclude collapsed empty option groups before paging", async () => {
  const index = {
    name: "foobars",
    collection: "foobars",
    fields: {
      id: { type: "string", derive: { kind: "collectionKey" } },
      title: { type: "string", path: ["title"] },
      state: { type: "string", path: ["state"] },
    },
  } as const;
  const query = collectionViewQuery({
    index: structuredClone(index) as never,
    attributes: [
      {
        id: "state",
        label: "State",
        type: { kind: "enum", options: [{ value: "open", label: "Open" }] },
      },
    ],
  });
  const ctx = makeCommandContext({ storage: createMemoryStorage(), params: {} });
  await ctx.storage.records.defineIndexes([index as never]);
  for (const [id, state] of [
    ["a", "open"],
    ["b", "removed"],
    ["c", null],
  ] as const)
    await ctx.storage.collection("foobars").put(id, { title: id, state });
  const page = {
    limit: 1,
    offset: 0,
    fields: ["state"],
    search: "",
    presentation: {
      state: { emptyGroup: "No état", options: [{ value: "open", label: "Ouvert" }] },
    },
  };
  const params = { page, settings: { columnGrouping: "state" } };
  const initial = await query(ctx, params as never);
  expect(initial.page?.groups).toEqual([
    { field: "state", value: "open", count: 1 },
    { field: "state", value: null, count: 2 },
  ]);
  const searched = await query(ctx, { ...params, page: { ...page, search: "ouvert" } } as never);
  expect(searched.page?.filteredTotal).toBe(1);
  const hiddenSearch = await query(ctx, {
    ...params,
    page: { ...page, fields: ["title", "state"], searchFields: ["title"], search: "ouvert" },
  } as never);
  expect(hiddenSearch.page?.filteredTotal).toBe(0);
  const collapsed = await query(ctx, { ...params, page: { ...page, collapsedGroups: ["No état"] } } as never);
  expect(collapsed.page?.filteredTotal).toBe(1);
  expect(collapsed.rows.map(({ id }) => id)).toEqual(["a"]);
});

test("default table statistics describe the complete filtered resource selection beyond its page", async () => {
  const index = {
    name: "foobars",
    collection: "foobars",
    fields: {
      id: { type: "string", derive: { kind: "collectionKey" } },
      title: { type: "string", path: ["title"] },
      region: { type: "string", path: ["region"] },
    },
  } as const;
  const query = collectionTableQuery({
    index: structuredClone(index) as never,
    columns: [
      { id: "title", stat: { type: "unique" } },
      { id: "region", stat: { type: "top-values", limit: 1 } },
    ],
  });
  const ctx = makeCommandContext({ storage: createMemoryStorage(), params: {} });
  await ctx.storage.records.defineIndexes([index as never]);
  for (let i = 0; i < 103; i++)
    await ctx.storage
      .collection("foobars")
      .put(String(i), { title: `Foobar ${i}`, region: i < 100 ? "Europe" : "APAC", body: "large".repeat(1000) });
  const params = {
    page: { limit: 2, offset: 0, fields: ["title", "region"], search: "" },
    settings: { showStats: true, hiddenColumns: [], grouping: "none" },
  };
  const result = await query(ctx, params as never);
  expect(result.rows).toHaveLength(2);
  expect(result.page?.statistics).toEqual({
    title: { type: "unique", count: 103 },
    region: {
      type: "top-values",
      values: [
        { label: "Europe", count: 100, percentage: 97 },
        { label: "Other", count: 3, percentage: 3 },
      ],
    },
  });
  expect(JSON.stringify(result)).not.toContain("largelarge");
  const filtered = await query(ctx, {
    ...params,
    filter: { conjunction: "and", rules: [{ attributeId: "region", condition: "is", value: "APAC" }] },
  } as never);
  expect(filtered.page?.statistics?.title).toEqual({ type: "unique", count: 3 });
});
