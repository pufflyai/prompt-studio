import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { putTicket } from "../data/ticket-context.fixture";
import { makeCommandContext } from "./command-context.fixture";
import { readNextTickets } from "./next-tickets";

test("automation counts the complete scope and discovers late candidates without loading collections", async () => {
  const storage = createMemoryStorage();
  for (let i = 0; i < 103; i++)
    await putTicket(storage, {
      id: `t-${i}`,
      shorthand: `T-${i}`,
      title: String(i),
      content: "body".repeat(1000),
      statusId: i >= 100 ? "ready" : "done",
      archived: false,
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
  });
  ctx.workspaces.list = async () => {
    throw new Error("Unbounded workspaces");
  };
  const mode = {
    revision: "test",
    enabled: true,
    prompt: "Work",
    blockOnReview: false,
    requireMergedDependencies: false,
    eligible: { conjunction: "and" as const, rules: [] },
  };
  const counts = await readNextTickets(ctx, mode, { limit: 0 }, [{}]);
  expect(counts.completed).toBe(false);
  expect(counts.matchingTicketCount).toBe(3);
  const next = await readNextTickets(ctx, mode, { limit: 1 }, [{}]);
  expect(next.tickets).toHaveLength(1);
  expect(["t-100", "t-101", "t-102"]).toContain(next.tickets[0].id);
});
