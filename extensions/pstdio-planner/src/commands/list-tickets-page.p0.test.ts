import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { putTicket } from "../data/ticket-context.fixture";
import { makeCommandContext } from "./command-context.fixture";
import { listTicketsCommand } from "./list-tickets";

test("CLI filters the full ticket set before reading a bounded bodyless page", async () => {
  const storage = createMemoryStorage();
  for (let i = 0; i < 103; i++)
    await putTicket(storage, {
      id: `t-${i}`,
      shorthand: `T-${i}`,
      title: String(i),
      content: "large".repeat(1000),
      archived: false,
      statusId: i >= 100 ? "done" : "ready",
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    });
  const ctx = makeCommandContext({ storage, params: {} });
  const original = storage.collection.bind(storage);
  storage.collection = <T>(name: string) => ({
    ...original<T>(name),
    list: async () => {
      throw new Error(`Unbounded ${name}`);
    },
    ...(name === "tickets"
      ? {
          get: async () => {
            throw new Error("List read a body");
          },
        }
      : {}),
  });
  const result = await listTicketsCommand.run(ctx, { status: "done", limit: 2 } as never);
  expect(result).toMatchObject({ total: 3 });
  expect(result.tickets).toHaveLength(2);
  expect(result.cursor).toBeString();
});

test("CLI listing restarts a changed first page but refuses a stale continuation", async () => {
  const storage = createMemoryStorage();
  const save = (id: string) =>
    putTicket(storage, {
      id,
      shorthand: `T-${id}`,
      title: id,
      content: id,
      archived: false,
      statusId: "ready",
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    });
  await save("first");
  const query = storage.records.query.bind(storage.records);
  let changed = false;
  storage.records.query = async (input) => {
    if (input.index === "ticket-view" && input.revision && !changed) {
      changed = true;
      await save("arrived");
    }
    return query(input);
  };
  const ctx = makeCommandContext({ storage, params: {} });
  const first = await listTicketsCommand.run(ctx, { limit: 1 } as never);
  expect(first.total).toBe(2);
  expect(first.tickets).toHaveLength(1);
  expect(first.cursor).toBeString();
  await save("later");
  await expect(listTicketsCommand.run(ctx, { limit: 1, cursor: first.cursor } as never)).rejects.toThrow("stale");
});
