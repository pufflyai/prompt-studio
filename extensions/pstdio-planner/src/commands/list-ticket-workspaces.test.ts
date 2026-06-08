import { describe, expect, test } from "bun:test";
import { ticketsCollection } from "../data/collections";
import { createMemoryStorage } from "../data/memory-storage";
import { makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { listTicketWorkspacesCommand } from "./list-ticket-workspaces";

describe("listTicketWorkspacesCommand", () => {
  test("hydrates linked workspaces and drops ids whose workspace is gone", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "Ticket" } }));
    await ticketsCollection(storage).put(ticket.id, { ...ticket, workspaceIds: ["ws-1", "missing", "ws-2"] });

    const details: Record<string, unknown> = {
      "ws-1": { id: "ws-1", workspace_shorthand: "WS-1", branch: "feature/a", name: "A", initializing: false },
      "ws-2": { id: "ws-2", workspace_shorthand: "WS-2", branch: "feature/b", name: "B", initializing: true },
    };

    const result = await listTicketWorkspacesCommand.run(
      makeCommandContext({
        storage,
        params: { ticket: ticket.id },
        overrides: {
          workspaces: { get: async (id: string) => details[id] ?? null } as never,
        },
      }),
    );

    expect(result).toEqual({
      workspaces: [
        { id: "ws-1", shorthand: "WS-1", branch: "feature/a", name: "A", initializing: false },
        { id: "ws-2", shorthand: "WS-2", branch: "feature/b", name: "B", initializing: true },
      ],
    });
  });

  test("returns an empty list when the ticket has no linked workspaces", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "Ticket" } }));

    const result = await listTicketWorkspacesCommand.run(
      makeCommandContext({
        storage,
        params: { ticket: ticket.id },
        overrides: { workspaces: { get: async () => null } as never },
      }),
    );

    expect(result).toEqual({ workspaces: [] });
  });
});
