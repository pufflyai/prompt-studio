import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { readAttemptHistoryCommand } from "./attempt-history";
import { createSessionResource, makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { runAttemptCommand } from "./run-attempt";

test("starting a ticket and reading its history never loads unrelated attempts or events", async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({
    storage,
    params: {},
    overrides: {
      workspaces: { create: async () => ({ id: "selected-workspace", workspace_shorthand: "WS-1" }) },
      sessions: { create: async () => createSessionResource() },
    },
  });
  const ticket = await createTicketCommand.run(ctx, { title: "Selected" });
  for (let i = 0; i < 5000; i++) {
    await storage.collection("planner-attempts").put(`unrelated-${i}`, {
      schemaVersion: 2,
      workspaceId: `unrelated-${i}`,
      ticketId: `unrelated-${i}`,
      implementationSessionId: `old-session-${i}`,
    });
    await storage.collection("planner-attempt-events").put(`unrelated-${i}`, {
      id: `unrelated-${i}`,
      workspaceId: `unrelated-${i}`,
      type: "attempt_started",
      createdAt: "2026-01-01",
    });
  }
  const collection = storage.collection.bind(storage);
  let eventReads = 0;
  storage.collection = <T>(name: string) => ({
    ...collection<T>(name),
    list: async () => {
      if (name === "ticket-statuses" || name === "ticket-tags") return collection<T>(name).list();
      throw Error(`Unbounded collection: ${name}`);
    },
  });
  const readMany = storage.records.readMany;
  storage.records.readMany = async (ids) => {
    const rows = await readMany(ids);
    for (const row of rows) {
      const value = (row.value as { value?: { type?: string; workspaceId?: string } } | null)?.value;
      if (value?.type) {
        expect(value.workspaceId).toBe("selected-workspace");
        eventReads++;
      }
    }
    return rows;
  };
  const result = await runAttemptCommand.run(ctx, { ticket: ticket.id });
  expect(result.variant.ticketId).toBe(ticket.id);
  for (let i = 0; i < 205; i++)
    await storage.collection("planner-attempt-events").put(`selected-${i}`, {
      id: `selected-${i}`,
      workspaceId: result.workspace.id,
      type: "attempt_started",
      createdAt: `2026-11-14T00:00:${String(i % 60).padStart(2, "0")}.000Z`,
    });
  const first = await readAttemptHistoryCommand.run(ctx, { workspaceId: result.workspace.id, limit: 100 });
  expect(first.events).toHaveLength(100);
  expect(first.nextCursor).toBeDefined();
  expect(eventReads).toBe(100);
  const second = await readAttemptHistoryCommand.run(ctx, {
    workspaceId: result.workspace.id,
    cursor: first.nextCursor!,
    limit: 100,
  });
  const third = await readAttemptHistoryCommand.run(ctx, {
    workspaceId: result.workspace.id,
    cursor: second.nextCursor!,
    limit: 100,
  });
  expect(second.events).toHaveLength(100);
  expect(third.events).toHaveLength(6);
  expect(new Set([...first.events, ...second.events, ...third.events].map(({ id }) => id)).size).toBe(206);
});
