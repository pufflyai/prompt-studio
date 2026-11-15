import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { makeCommandContext } from "../../commands/command-context.fixture";
import { putTicket } from "../../data/ticket-context.fixture";
import { readPlanCommand } from "./read-plan";

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
  expect(result.sections[0]!.globalCounts.total).toBe(103);
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
