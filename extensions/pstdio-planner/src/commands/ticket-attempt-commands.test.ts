import { describe, expect, test } from "bun:test";
import { allocateTicketIdentity, putTicket, ticketsCollection } from "../data/collections";
import { createMemoryStorage } from "../data/memory-storage";
import { seedDefaultStatuses } from "../data/seed";
import type { StoredTicket } from "../data/types";
import { commandParamsFor, makeCommandArgs, makeCommandContext } from "./command-context.fixture";
import { implementTicketCommand } from "./implement-ticket";
import { ticketWorkspacesCommand, ticketWorktreesListCommand } from "./ticket-workspaces";

const createSessionResource = () => ({
  type: "session" as const,
  id: "s1",
  title: "Implement ticket: T-1",
  status: "in_progress" as const,
});

const seedTicket = async (storage: ReturnType<typeof createMemoryStorage>, overrides: Partial<StoredTicket> = {}) => {
  const now = new Date().toISOString();
  const { shorthand, sortOrder } = allocateTicketIdentity("T", await ticketsCollection(storage).list());
  return putTicket(storage, {
    id: crypto.randomUUID(),
    shorthand,
    title: "Ticket",
    content: "# Ticket",
    statusId: "backlog",
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
        sessions: {
          create: async (input) => {
            created.push(input);
            return createSessionResource();
          },
          followup: async () => {},
        },
      },
    });

    const result = await implementTicketCommand.run(ctx, commandParamsFor(ctx));

    expect(result).toEqual(createSessionResource());
    expect((await ticketsCollection(storage).get(ticket.id))!.statusId).toBe("in-progress");
    expect(created).toEqual([
      expect.objectContaining({
        title: `Implement ticket: ${ticket.shorthand}`,
        prompt: expect.stringContaining(ticket.id),
      }),
    ]);
  });
});

describe("ticket workspace listing", () => {
  const sessionsByWorkspace: Record<string, Array<{ id: string; title: string; status: string }>> = {
    w1: [{ id: "s1", title: "Implement", status: "in_progress" }],
    w2: [{ id: "s2", title: "Implement", status: "completed" }],
  };

  const listContext = (storage: ReturnType<typeof createMemoryStorage>, id: string) =>
    makeCommandArgs({
      storage,
      params: { id },
      overrides: {
        workspaces: {
          list: async () => [
            { id: "w1", workspace_shorthand: "T-1_A1", branch: "b1", worktree_path: "/wt/1" },
            { id: "w2", workspace_shorthand: "T-1_A2", branch: "b2", worktree_path: null },
            { id: "w3", workspace_shorthand: "T-2_A1", branch: "b3", worktree_path: "/wt/3" },
          ],
        },
        sessions: {
          listByWorkspace: async (workspaceId: string) => sessionsByWorkspace[workspaceId] ?? [],
        },
      } as never,
    });

  test("workspaces returns the ticket's workspaces with live activity", async () => {
    const storage = createMemoryStorage();
    const ticket = await seedTicket(storage);

    const rows = await ticketWorkspacesCommand.run(...listContext(storage, ticket.shorthand));
    expect(rows).toEqual([
      { id: "w1", workspace: "T-1_A1", branch: "b1", path: "/wt/1", active: true },
      { id: "w2", workspace: "T-1_A2", branch: "b2", path: "", active: false },
    ]);
  });

  test("worktrees list returns only the ticket's workspaces with a worktree path", async () => {
    const storage = createMemoryStorage();
    const ticket = await seedTicket(storage);

    const rows = await ticketWorktreesListCommand.run(...listContext(storage, ticket.shorthand));
    expect(rows.map((row) => row.workspace)).toEqual(["T-1_A1"]);
  });
});
