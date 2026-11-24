import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { makeCommandContext } from "../../commands/command-context.fixture";
import { putTicket } from "../../data/ticket-context.fixture";
import { planPlacements, readPlanMetadata } from "./placement-store";
import { readPlanCommand } from "./read-plan";

test("Timeline retains linked-resource badges with its title and ID search projection", async () => {
  const storage = createMemoryStorage();
  await putTicket(storage, {
    id: "ticket",
    shorthand: "T-1",
    title: "Ticket",
    content: "# Ticket",
    statusId: "ready",
    archived: false,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  });
  const ctx = makeCommandContext({ storage, params: {} });
  const ticket = { type: "ticket", id: "ticket", extensionId: ctx.extensionId, projectId: ctx.projectId };
  const artifact = { type: "artifact", id: "artifact", extensionId: "example.artifacts", label: "Prototype" };
  await ctx.resources.addAnchors(ticket, [artifact]);
  const result = await readPlanCommand.run(ctx, {
    page: { limit: 100, offset: 0, fields: ["title", "id"], search: "" },
  });
  expect(result.ticketRows[0].attributes.linkedResourceItems).toMatchObject([{ label: "Prototype" }]);
});

test("looking up an off-window Timeline ticket skips project-wide pace and grouping", async () => {
  const storage = createMemoryStorage();
  await putTicket(storage, {
    id: "selected",
    shorthand: "T-1",
    title: "Selected",
    content: "# Selected",
    statusId: "ready",
    archived: false,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  });
  const ctx = makeCommandContext({ storage, params: {} });
  await readPlanCommand.run(ctx, {});
  const aggregate = storage.records.aggregate.bind(storage.records);
  storage.records.aggregate = async (query) => {
    if (query.index === "ticket-view") {
      expect(query.groupBy).toBeUndefined();
      expect(query.metrics?.completedComplexity).toBeUndefined();
    }
    return aggregate(query);
  };

  ctx.views.list = async () => {
    throw new Error("A point read should skip the saved views list");
  };
  const result = await readPlanCommand.run(ctx, { ticketId: "selected" });

  expect(result.sections.flatMap(({ rows }) => rows.map(({ id }) => id))).toEqual(["selected"]);
  expect(result.pace).toBeNull();
  expect(result.savedViews).toEqual({ views: [], defaultViewId: null });
});

test("Timeline filters before paging and counts unloaded work without listing resources", async () => {
  const storage = createMemoryStorage();
  let previous: string | undefined;
  for (let i = 0; i < 103; i++) {
    const position = storage.positions.between(previous);
    previous = position;
    await putTicket(storage, {
      id: `ticket-${String(i).padStart(4, "0")}`,
      shorthand: `T-${i + 1}`,
      title: i > 99 ? `Late match ${i}` : "Background",
      content: "Body".repeat(1000),
      statusId: i > 99 ? "done" : "ready",
      archived: false,
      position,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    });
  }
  const ctx = makeCommandContext({ storage, params: {} });
  const collection = storage.collection.bind(storage);
  storage.collection = <T>(name: string) => ({
    ...collection<T>(name),
    list: async () => {
      throw new Error(`Unbounded ${name}`);
    },
    ...(name === "tickets"
      ? {
          get: async () => {
            throw new Error("Timeline loaded a ticket body");
          },
        }
      : {}),
  });
  storage.records.list = async () => {
    throw new Error("Unbounded records");
  };
  const result = await readPlanCommand.run(ctx, {
    filter: { conjunction: "and", rules: [{ attributeId: "status", condition: "is-any-of", value: ["done"] }] },
    page: { limit: 2, offset: 0, fields: ["id"], search: "" },
  } as never);
  expect(result.ticketRows).toHaveLength(2);
  expect(result.page.total).toBe(3);
  expect(result.sections[0]!.counts).toMatchObject({ total: 3, done: 3 });
  expect(result.sections[0]!.globalCounts?.total).toBe(103);
  expect(result.sections.flatMap(({ rows }) => rows.map(({ step }) => step))).toEqual([1, 2]);
  const aggregate = storage.records.aggregate.bind(storage.records);
  let stepQueries = 0;
  storage.records.aggregate = async (query) => {
    if (Object.keys(query.metrics ?? {}).some((name) => name.startsWith("step"))) stepQueries++;
    return aggregate(query);
  };
  const fullPage = await readPlanCommand.run(ctx, {
    filter: { conjunction: "and", rules: [{ attributeId: "status", condition: "is-any-of", value: ["ready"] }] },
    page: { limit: 100, offset: 0, fields: ["id"], search: "" },
  } as never);
  expect(fullPage.ticketRows).toHaveLength(100);
  expect(fullPage.sections.flatMap(({ rows }) => rows.map(({ step }) => step))).toEqual(
    Array.from({ length: 100 }, (_, i) => i + 4),
  );
  expect(stepQueries).toBeLessThanOrEqual(7);
});

test("tickets added and restored after the initial placement migration receive execution positions", async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {} });
  const ticket = (id: string, archived = false) => ({
    id,
    shorthand: `T-${id}`,
    title: id,
    content: `# ${id}`,
    statusId: "ready",
    archived,
    position: storage.positions.between(),
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  });
  await putTicket(storage, ticket("first"));
  await putTicket(storage, ticket("restored", true));
  await readPlanCommand.run(ctx, {});
  await putTicket(storage, ticket("late"));
  await putTicket(storage, ticket("restored"));
  const result = await readPlanCommand.run(ctx, {});
  expect(result.ticketRows).toHaveLength(3);
  const placements = await storage.records.aggregate({ index: "timeline-placements" });
  expect(placements.count).toBe(3);
});

test("filtered global steps exclude archived tickets and placements whose ticket no longer exists", async () => {
  const storage = createMemoryStorage();
  for (const id of ["first", "archived", "last"])
    await putTicket(storage, {
      id,
      shorthand: `T-${id}`,
      title: id,
      content: "",
      statusId: "ready",
      archived: id === "archived",
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    });
  await readPlanMetadata(storage);
  for (const [i, id] of ["first", "archived", "missing", "last"].entries())
    await planPlacements(storage).put(id, { ticketId: id, deadlineId: null, position: String(i) });
  const result = await readPlanCommand.run(makeCommandContext({ storage, params: {} }), {
    filter: { conjunction: "and", rules: [{ attributeId: "title", condition: "is", value: "last" }] },
    page: { limit: 1, offset: 0, fields: ["id"], search: "" },
  } as never);
  expect(result.sections.flatMap(({ rows }) => rows.map(({ id, step }) => ({ id, step })))).toEqual([
    { id: "last", step: 2 },
  ]);
});

test("the default active filter retains global steps on later pages and narrower nested views", async () => {
  const storage = createMemoryStorage();
  for (const [i, id] of ["first", "archived", "second", "last"].entries())
    await putTicket(storage, {
      id,
      shorthand: `T-${i + 1}`,
      title: id,
      content: "",
      statusId: "ready",
      archived: id === "archived",
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    });
  await readPlanMetadata(storage);
  for (const [i, id] of ["first", "archived", "second", "last"].entries())
    await planPlacements(storage).put(id, { ticketId: id, deadlineId: null, position: String(i) });
  const active = { attributeId: "archived", condition: "is-any-of", value: ["active"] } as const;
  const read = (filter: unknown, offset: number, cursor?: string) =>
    readPlanCommand.run(makeCommandContext({ storage, params: {} }), {
      filter,
      page: { limit: 1, offset, cursor, fields: ["id"], search: "" },
    } as never);
  const steps = (value: Awaited<ReturnType<typeof read>>) =>
    value.sections.flatMap(({ rows }) => rows.map(({ id, step }) => ({ id, step })));
  expect(steps(await read({ conjunction: "and", rules: [active] }, 1))).toEqual([{ id: "second", step: 2 }]);
  expect(steps(await read(undefined, 9, (await read(undefined, 0)).page.cursor!))).toEqual([{ id: "second", step: 2 }]);
  const last = { attributeId: "title", condition: "is", value: "last" };
  expect(
    steps(await read({ conjunction: "and", rules: [active], groups: [{ conjunction: "or", rules: [last] }] }, 0)),
  ).toEqual([{ id: "last", step: 3 }]);
});

test("Timeline counts an unchanged visible selection once", async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {} });
  await readPlanCommand.run(ctx, {});
  const aggregate = storage.records.aggregate.bind(storage.records);
  let counts = 0;
  let summaries = 0;
  storage.records.aggregate = (query) => {
    if (query.index === "ticket-view" && !query.groupBy && !query.metrics) counts++;
    if (query.index === "ticket-view" && query.groupBy === "deadlineId" && query.metrics?.totalComplexity) summaries++;
    return aggregate(query);
  };
  const result = await readPlanCommand.run(ctx, {});
  expect(result.page).toMatchObject({ total: 0, filteredTotal: 0 });
  expect(counts).toBe(1);
  expect(summaries).toBe(1);
});
