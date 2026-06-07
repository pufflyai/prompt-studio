import { describe, expect, test } from "bun:test";
import { allocateTicketIdentity, putTicket, ticketsCollection } from "../data/collections";
import { createMemoryStorage } from "../data/memory-storage";
import { seedDefaultStatuses } from "../data/seed";
import type { StoredTicket } from "../data/types";
import { makeCommandContext } from "./command-context.fixture";
import { implementTicketCommand } from "./implement-ticket";
import { ticketWorkspacesCommand, ticketWorktreesListCommand } from "./ticket-workspaces";
import { updateWhenAttemptStatusCommand } from "./update-when-attempt-status";

const seedTicket = async (storage: ReturnType<typeof createMemoryStorage>, overrides: Partial<StoredTicket> = {}) => {
  const now = new Date().toISOString();
  const { shorthand, sortOrder } = allocateTicketIdentity(await ticketsCollection(storage).list());
  return putTicket(storage, {
    id: crypto.randomUUID(),
    shorthand,
    title: "Ticket",
    content: "# Ticket",
    statusId: "default-backlog",
    tagIds: [],
    attachments: [],
    parentId: null,
    dependsOn: null,
    blockedReason: null,
    userPrompt: null,
    parallelizable: null,
    draft: false,
    archived: false,
    sortOrder,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
};

describe("implementTicketCommand", () => {
  test("moves the ticket to In Progress and launches a session via the template", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    const ticket = await seedTicket(storage);

    const created: unknown[] = [];
    const ctx = makeCommandContext({
      storage,
      params: { id: ticket.shorthand },
      overrides: {
        sessions: { create: async (input) => (created.push(input), { id: "s1" }), followup: async () => {} },
      },
    });

    const result = await implementTicketCommand.run(ctx);

    expect(result).toEqual({ id: "s1" });
    expect((await ticketsCollection(storage).get(ticket.id))!.statusId).toBe("default-in-progress");
    expect(created).toEqual([
      { title: `Implement ticket: ${ticket.shorthand}`, template: "implement-ticket", vars: { ticket: ticket.id } },
    ]);
  });
});

describe("updateWhenAttemptStatusCommand", () => {
  const workspacesContext = (storage: ReturnType<typeof createMemoryStorage>, id: string, attempt: string) =>
    makeCommandContext({
      storage,
      params: { id, allAttemptsStatus: "merged", setStatus: "Done" },
      overrides: {
        workspaces: {
          list: async () => [
            { id: "w1", ticket_shorthand: "T-1", attempt_status_name: attempt },
            { id: "w2", ticket_shorthand: "T-1", attempt_status_name: attempt },
          ],
        },
      } as never,
    });

  test("updates the ticket when every workspace matches", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    const ticket = await seedTicket(storage);

    const result = await updateWhenAttemptStatusCommand.run(workspacesContext(storage, ticket.shorthand, "merged"));

    expect(result).toEqual({ updated: true, status: "Done" });
    expect((await ticketsCollection(storage).get(ticket.id))!.statusId).toBe("default-done");
  });

  test("leaves the ticket unchanged when a workspace does not match", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    const ticket = await seedTicket(storage);

    const result = await updateWhenAttemptStatusCommand.run(workspacesContext(storage, ticket.shorthand, "open"));

    expect(result).toEqual({ updated: false });
    expect((await ticketsCollection(storage).get(ticket.id))!.statusId).toBe("default-backlog");
  });
});

describe("ticket workspace listing", () => {
  const listContext = (storage: ReturnType<typeof createMemoryStorage>, id: string) =>
    makeCommandContext({
      storage,
      params: { id },
      overrides: {
        workspaces: {
          list: async () => [
            { id: "w1", workspace_shorthand: "T-1_A1", ticket_shorthand: "T-1", branch: "b1", worktree_path: "/wt/1" },
            { id: "w2", workspace_shorthand: "T-1_A2", ticket_shorthand: "T-1", branch: "b2", worktree_path: null },
            { id: "w3", workspace_shorthand: "T-2_A1", ticket_shorthand: "T-2", branch: "b3", worktree_path: "/wt/3" },
          ],
        },
      } as never,
    });

  test("workspaces returns only the ticket's workspaces", async () => {
    const storage = createMemoryStorage();
    const ticket = await seedTicket(storage);

    const rows = await ticketWorkspacesCommand.run(listContext(storage, ticket.shorthand));
    expect(rows.map((row) => row.workspace)).toEqual(["T-1_A1", "T-1_A2"]);
  });

  test("worktrees list returns only the ticket's workspaces with a worktree path", async () => {
    const storage = createMemoryStorage();
    const ticket = await seedTicket(storage);

    const rows = await ticketWorktreesListCommand.run(listContext(storage, ticket.shorthand));
    expect(rows.map((row) => row.workspace)).toEqual(["T-1_A1"]);
  });
});
