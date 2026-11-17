import { expect, test } from "bun:test";
import { createMemoryStorage } from "../testing/memory-storage";
import { type CollectionViewSelection, readCollectionViewPage } from "./collection-view";

test("date controls preserve the viewer's calendar and localized search before paging", async () => {
  const storage = createMemoryStorage({
    indexes: [{ name: "dates", collection: "dates", fields: { date: { path: ["date"], type: "string" } } }],
  });
  await storage.collection("dates").put("a", { date: "2026-11-14T01:00:00Z" });
  await storage.collection("dates").put("b", { date: "2026-11-14T10:00:00Z" });
  const input = {
    index: "dates",
    fields: { created: { field: "date", kind: "date" as const } },
    select: ["date"],
    page: {
      limit: 1,
      offset: 0,
      fields: ["created"],
      search: "14.11",
      viewer: { locale: "de-DE", timeZone: "America/New_York", now: "2026-11-14T12:00:00Z" },
    },
  };
  const result = await readCollectionViewPage(storage, {
    ...input,
    filter: { conjunction: "and", rules: [{ attributeId: "created", condition: "is", value: "today" }] },
  });
  expect(result.records.map(({ fields }) => fields.date)).toEqual(["2026-11-14T10:00:00Z"]);
  expect(result.page.total).toBe(1);
  expect(result.page.filteredTotal).toBe(1);
});

test("date filter targets use the same calendar rollover as displayed date values", async () => {
  const storage = createMemoryStorage({
    indexes: [{ name: "calendar", collection: "calendar", fields: { date: { path: ["date"], type: "string" } } }],
  });
  await storage.collection("calendar").put("rolled", { date: "2026-03-02" });
  const result = await readCollectionViewPage(storage, {
    index: "calendar",
    fields: { date: { field: "date", kind: "date" } },
    filter: { conjunction: "and", rules: [{ attributeId: "date", condition: "is", value: "2026-02-30" }] },
    page: {
      limit: 1,
      offset: 0,
      fields: ["date"],
      search: "",
      viewer: { locale: "en-US", timeZone: "America/New_York", now: "2026-11-14T12:00:00Z" },
    },
  });
  expect(result.page.filteredTotal).toBe(1);
  expect(result.records.map(({ fields }) => fields.date)).toEqual(["2026-03-02"]);
});

test("the default view adapter filters, searches, counts and groups before selecting a bounded page", async () => {
  const storage = createMemoryStorage({
    indexes: [
      {
        name: "foobar",
        collection: "foobar",
        fields: {
          id: { path: ["id"], type: "string" },
          title: { path: ["title"], type: "string" },
          status: { path: ["status"], type: "string" },
        },
        orderBy: [{ field: "id", direction: "asc" }],
      },
    ],
  });
  for (let i = 0; i < 203; i++)
    await storage.collection("foobar").put(String(i).padStart(3, "0"), {
      id: String(i).padStart(3, "0"),
      title: `Foobar ${i}`,
      status: i > 199 ? "ready" : "draft",
    });
  storage.records.list = async () => {
    throw new Error("Unbounded read");
  };
  const result = await readCollectionViewPage(storage, {
    index: "foobar",
    fields: {
      title: { field: "title", kind: "string" },
      status: {
        field: "status",
        kind: "enum",
        options: [
          { value: "ready", label: "Ready" },
          { value: "draft", label: "Draft" },
        ],
      },
    },
    filter: { conjunction: "and", rules: [{ attributeId: "status", condition: "is-any-of", value: ["ready"] }] },
    page: { limit: 2, offset: 0, fields: ["title", "status"], search: "ready" },
    searchFields: ["title", "status"],
    groups: ["status"],
  });
  expect(result.records.map((record) => record.fields.title)).toEqual(["Foobar 200", "Foobar 201"]);
  expect(result.page.total).toBe(3);
  expect(result.page.filteredTotal).toBe(3);
  expect(result.page.groups).toEqual([{ field: "status", value: "ready", count: 3 }]);
  expect(result.page.cursor).toBeString();
});

test("paged controls retain natural text order, option order, missing-last and unknown-option search", async () => {
  const storage = createMemoryStorage({
    indexes: [
      {
        name: "controls",
        collection: "controls",
        fields: {
          title: { type: "string", path: ["title"] },
          phase: { type: "string", path: ["phase"] },
          tags: { type: "array", path: ["tags"] },
          rank: { type: "number", path: ["rank"] },
        },
        orderBy: [{ field: "rank", direction: "asc" }],
      },
    ],
  });
  const rows = [
    { title: "Item 10", phase: "later", tags: ["unknown-42"], rank: 0 },
    { title: "item 2", phase: "earlier", tags: ["known"], rank: 1 },
    { title: "", phase: "removed", tags: ["known", "ÉMERGENT"], rank: 2 },
    { title: "Ítem 1", tags: [], rank: 3 },
  ];
  for (const [i, row] of rows.entries()) await storage.collection("controls").put(String(i), row);
  const input: CollectionViewSelection = {
    index: "controls",
    select: ["title", "rank"],
    orderBy: [{ field: "rank", direction: "asc" }],
    computed: { selectedPhase: { type: "string", expression: { field: "phase" } } },
    fields: {
      title: { field: "title", kind: "string" },
      phase: {
        field: "selectedPhase",
        kind: "enum",
        options: [
          { value: "earlier", label: "Draft" },
          { value: "later", label: "Ready" },
        ],
      },
      tags: { field: "tags", kind: "enum-multi", options: [{ value: "known", label: "Ready" }] },
    },
    page: {
      limit: 2,
      offset: 0,
      fields: ["title"],
      search: "",
      viewer: { locale: "en-US", timeZone: "UTC", now: "2026-11-14T12:00:00Z" },
    },
  };
  for (const [attributeId, direction, expected] of [
    ["title", "asc", [3, 1]],
    ["title", "desc", [0, 1]],
    ["phase", "asc", [1, 0]],
    ["phase", "desc", [2, 0]],
  ] as const) {
    const result = await readCollectionViewPage(storage, { ...input, sorts: [{ attributeId, direction }] });
    expect(result.records.map(({ fields }) => fields.rank)).toEqual([...expected]);
    expect(result.page.filteredTotal).toBe(4);
  }
  for (const [field, search, expected] of [
    ["phase", "remov", [2]],
    ["tags", "émer", [2]],
    ["tags", "ready", [1, 2]],
    ["tags", "known", [0]],
  ] as const) {
    const result = await readCollectionViewPage(storage, {
      ...input,
      searchFields: [field],
      page: { ...input.page!, search },
    });
    expect(result.records.map(({ fields }) => fields.rank)).toEqual([...expected]);
  }
});

test("numeric and boolean groups collapse by native string keys before paging", async () => {
  const storage = createMemoryStorage({
    indexes: [
      {
        name: "groups",
        fields: {
          number: { path: ["number"], type: "number" },
          bool: { path: ["bool"], type: "boolean" },
        },
      },
    ],
  });
  await storage.records.commit({
    operationId: "seed",
    edits: Array.from({ length: 203 }, (_, i) => ({
      recordId: String(i),
      replace: { number: i % 2, bool: Boolean(i % 2) },
    })),
  });
  for (const [field, kind, key] of [
    ["number", "number", "1"],
    ["bool", "boolean", "true"],
  ] as const) {
    const result = await readCollectionViewPage(storage, {
      index: "groups",
      fields: { [field]: { field, kind } },
      groups: [field],
      page: { limit: 2, offset: 0, fields: [field], search: "", collapsedGroups: [key] },
    });
    expect(result.page.filteredTotal).toBe(102);
    expect(result.records).toHaveLength(2);
    expect(result.records.every(({ fields }) => fields[field] === (kind === "number" ? 0 : false))).toBe(true);
  }
  for (const [condition, value, count] of [
    ["is-any-of", ["1"], 101],
    ["is-any-of", ["01"], 0],
    ["is-none-of", ["01"], 203],
  ] as const) {
    const result = await readCollectionViewPage(storage, {
      index: "groups",
      fields: { number: { field: "number", kind: "number" } },
      filter: { conjunction: "and", rules: [{ attributeId: "number", condition, value: [...value] }] },
      page: { limit: 2, offset: 0, fields: ["number"], search: "" },
    });
    expect(result.page.total).toBe(count);
  }
  const obsolete = await readCollectionViewPage(storage, {
    index: "groups",
    fields: { number: { field: "number", kind: "number" } },
    sorts: [{ attributeId: "deleted-column", direction: "asc" }],
    page: { limit: 2, offset: 0, fields: ["number"], search: "" },
  });
  expect(obsolete.page.total).toBe(203);
  const deletedGroup = await readCollectionViewPage(storage, {
    index: "groups",
    fields: { number: { field: "number", kind: "number" } },
    groups: ["deleted-column"],
    page: { limit: 2, offset: 0, fields: ["number"], search: "", collapsedGroups: ["old-value"] },
  });
  expect(deletedGroup.page.filteredTotal).toBe(203);
  expect(deletedGroup.page.groups).toEqual([]);
});

test("constant and conditional computed dates use viewer semantics without a persisted formatting cache", async () => {
  const storage = createMemoryStorage({
    indexes: [{ name: "dates", fields: { late: { path: ["late"], type: "boolean" } } }],
  });
  await storage.records.commit({
    operationId: "seed",
    edits: [
      { recordId: "a", replace: { late: true } },
      { recordId: "b", replace: { late: false } },
    ],
  });
  for (const date of [
    { type: "string", expression: { literal: "2026-11-14" } },
    {
      type: "string",
      cases: [{ when: { field: "late", op: "eq", value: true }, value: "2026-11-14" }],
      otherwise: "2026-11-13",
    },
  ] as const) {
    const input: CollectionViewSelection = {
      index: "dates",
      fields: { date: { field: "computedDate", kind: "date" } },
      computed: { computedDate: structuredClone(date) as never },
      searchFields: ["date"],
      sorts: [{ attributeId: "date", direction: "desc" }],
      page: {
        limit: 1,
        offset: 0,
        fields: ["date"],
        search: "14.11",
        viewer: { locale: "de-DE", timeZone: "UTC", now: "2026-11-14T12:00:00Z" },
      },
    };
    const result = await readCollectionViewPage(storage, input);
    expect(result.records.map(({ recordId }) => recordId)).toEqual(["a"]);
    expect(result.page.filteredTotal).toBe("expression" in date ? 2 : 1);
  }
});

test("large multi-select controls use bounded expressions rather than a predicate per option", async () => {
  const values = Array.from({ length: 203 }, (_, i) => `v${i}`);
  const storage = createMemoryStorage({
    indexes: [{ name: "tags", fields: { tags: { path: ["tags"], type: "array" } } }],
  });
  await storage.records.commit({
    operationId: "seed",
    edits: [
      { recordId: "a", replace: { tags: values } },
      { recordId: "b", replace: { tags: ["v0", "v0"] } },
      { recordId: "c", replace: { tags: ["unknown"] } },
    ],
  });
  const input: CollectionViewSelection = {
    index: "tags",
    fields: {
      tags: { field: "tags", kind: "enum-multi", options: values.map((value) => ({ value, label: `Label ${value}` })) },
    },
    searchFields: ["tags"],
    page: { limit: 1, offset: 0, fields: ["tags"], search: "label" },
  };
  expect((await readCollectionViewPage(storage, input)).page.filteredTotal).toBe(2);
  for (const [condition, count] of [
    ["has-any-of", 2],
    ["has-all-of", 1],
    ["has-none-of", 1],
  ] as const) {
    const result = await readCollectionViewPage(storage, {
      ...input,
      page: { ...input.page!, search: "" },
      filter: { conjunction: "and", rules: [{ attributeId: "tags", condition, value: values }] },
    });
    expect(result.page.total).toBe(count);
  }
});
