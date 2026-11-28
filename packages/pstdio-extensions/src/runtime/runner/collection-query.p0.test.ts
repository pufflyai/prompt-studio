import { expect, test } from "bun:test";
import { defineView } from "@pstdio/sdk/extensions";
import { validateCollectionQueryResult } from "./collection-query";
import { createCommandRunner } from "./runner";
import { buildRuntime, makeStorage, stubEnvironment } from "./runner.test-fixture";

test("two-level group summaries allow a parent and child per bounded combination", () => {
  const result = {
    rows: [{ id: "a" }, { id: "b" }],
    page: {
      revision: "r",
      cursor: null,
      total: 300,
      filteredTotal: 300,
      groups: Array.from({ length: 300 }, (_, i) => [
        { field: "column", value: String(i), count: 1 },
        { field: "row", value: "one", count: 1, parent: { field: "column", value: String(i) } },
      ]).flat(),
    },
  };
  expect(() => validateCollectionQueryResult({ mode: "paged" }, { page: { limit: 2 } }, result)).not.toThrow();
  expect(() =>
    validateCollectionQueryResult(
      { mode: "paged" },
      { page: { limit: 2 } },
      { ...result, page: { ...result.page, groups: Array.from({ length: 1001 }, () => result.page.groups[0]) } },
    ),
  ).toThrow("bounded");
});

test("paged renderer queries reject complete collection reads before touching storage, including nested commands", async () => {
  const { api: storage } = makeStorage();
  let reads = 0;
  const collection = storage.collection.bind(storage);
  storage.collection = (name) => ({
    ...collection(name),
    list: async () => {
      reads++;
      return [];
    },
  });
  const runtime = buildRuntime({
    commands: [
      {
        id: "unsafe",
        ref: { kind: "command", id: "unsafe" },
        title: "Unsafe",
        run: (ctx) =>
          ctx.storage
            .scope({ type: "resource", resource: { type: "foobar", id: "one" } })
            .collection("foobars")
            .list(),
      },
    ],
    views: [
      {
        id: "foobars",
        ref: { kind: "view", id: "foobars" },
        title: "Foobars",
        body: {
          kind: "kanban",
          queryMode: "paged",
          query: async (ctx) => {
            const outcome = await ctx.commands.execute({ kind: "command", id: "unsafe" }, { params: {} });
            if (!outcome.ok) throw new Error(outcome.reason);
            return { rows: [], page: { revision: "one", cursor: null, total: 0, filteredTotal: 0, groups: [] } };
          },
        },
      },
    ],
  });
  const runner = createCommandRunner(runtime, { buildEnvironment: () => stubEnvironment(storage) });
  const result = await runner.execute({
    commandId: runtime.privateHandlers.find(({ operation }) => operation === "query")!.id,
    projectId: "p1",
  });
  expect(result).toMatchObject({ ok: false });
  expect("reason" in result && result.reason).toContain("bounded");
  expect(reads).toBe(0);
});

test("paged providers cannot omit counts or return more rows than requested; old full providers retain their contract", async () => {
  const { api: storage } = makeStorage();
  const run = async (queryMode: "paged" | undefined, rows: number) => {
    const runtime = buildRuntime({
      views: [
        defineView({
          id: "probe",
          title: "Probe",
          body: {
            kind: "kanban",
            queryMode,
            query: async () => ({
              rows: Array.from({ length: rows }, (_, i) => ({ id: String(i), title: String(i), attributes: {} })),
            }),
          },
        }),
      ],
    });
    return createCommandRunner(runtime, { buildEnvironment: () => stubEnvironment(storage) }).execute({
      commandId: runtime.privateHandlers[0]!.id,
      projectId: "p1",
      params: { page: { limit: 2, offset: 0, fields: [], search: "" } },
    });
  };
  expect((await run("paged", 3)).ok).toBe(false);
  expect((await run("paged", 1)).ok).toBe(false);
  expect((await run(undefined, 3)).ok).toBe(true);
});

test("paged queries allow zero rows for summaries and reject invalid limits before running", async () => {
  const { api: storage } = makeStorage();
  let reads = 0;
  const metadata = { revision: "r", cursor: null, total: 120, filteredTotal: 120, groups: [] };
  const runtime = buildRuntime({
    views: [
      {
        id: "probe",
        ref: { kind: "view", id: "probe" },
        title: "Probe",
        body: {
          kind: "kanban",
          queryMode: "paged",
          query: async () => {
            reads++;
            return { rows: [], page: metadata };
          },
        },
      },
    ],
  });
  const runner = createCommandRunner(runtime, { buildEnvironment: () => stubEnvironment(storage) });
  const execute = (limit: number) =>
    runner.execute({
      commandId: runtime.privateHandlers[0]!.id,
      projectId: "p1",
      params: { page: { limit } },
    });
  expect((await execute(-1)).ok).toBe(false);
  expect((await execute(501)).ok).toBe(false);
  expect(reads).toBe(0);
  expect(await execute(0)).toMatchObject({ ok: true, value: { rows: [], page: metadata } });
  expect(reads).toBe(1);
  expect(() =>
    validateCollectionQueryResult({ mode: "paged" }, { page: { limit: 0 } }, { rows: [{ id: "a" }], page: metadata }),
  ).toThrow("more than 0 rows");
});

test("row limits include deeply nested table resources", async () => {
  const { api: storage } = makeStorage();
  const runtime = buildRuntime({
    views: [
      {
        id: "probe",
        ref: { kind: "view", id: "probe" },
        title: "Probe",
        body: {
          kind: "dataTable",
          columns: [],
          queryMode: "paged",
          query: async () => ({
            rows: [
              {
                id: "root",
                values: {},
                children: [{ id: "child", values: {}, children: [{ id: "grandchild", values: {} }] }],
              },
            ],
            page: { revision: "r", cursor: null, total: 3, filteredTotal: 3, groups: [] },
          }),
        },
      },
    ],
  });
  const result = await createCommandRunner(runtime, { buildEnvironment: () => stubEnvironment(storage) }).execute({
    commandId: runtime.privateHandlers[0]!.id,
    projectId: "p1",
    params: { page: { limit: 2 } },
  });
  expect(result.ok).toBe(false);
});

test("collection providers require a bounded automation activity read", async () => {
  const { api: storage } = makeStorage();
  const environment = stubEnvironment(storage);
  let reads = 0;
  environment.automation.list = async () => {
    reads++;
    return [];
  };
  const runtime = buildRuntime({
    views: [
      {
        id: "probe",
        ref: { kind: "view", id: "probe" },
        title: "Probe",
        body: {
          kind: "kanban",
          queryMode: "paged",
          query: async (ctx) => {
            await ctx.automation.list();
            return { rows: [], page: { revision: "r", cursor: null, total: 0, filteredTotal: 0, groups: [] } };
          },
        },
      },
    ],
  });
  const result = await createCommandRunner(runtime, { buildEnvironment: () => environment }).execute({
    commandId: runtime.privateHandlers[0]!.id,
    projectId: "p1",
  });
  expect(result.ok).toBe(false);
  expect(reads).toBe(0);
});
