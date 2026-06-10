import { describe, expect, test } from "bun:test";
import { allocateTicketIdentity, putTicket, ticketsCollection } from "../data/collections";
import { createMemoryStorage } from "../data/memory-storage";
import { seedDefaultStatuses } from "../data/seed";
import type { StoredTicket } from "../data/types";
import { setWorkspaceStatusValue } from "../workspace-statuses/workspace-status";
import { makeCommandContext } from "./command-context.fixture";
import { implementTicketCommand } from "./implement-ticket";
import { ticketWorkspacesCommand, ticketWorktreesListCommand } from "./ticket-workspaces";
import { updateWhenAttemptStatusCommand } from "./update-when-attempt-status";

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
        sessions: {
          create: async (input) => {
            created.push(input);
            return createSessionResource();
          },
          followup: async () => {},
        },
      },
    });

    const result = await implementTicketCommand.run(ctx);

    expect(result).toEqual(createSessionResource());
    expect((await ticketsCollection(storage).get(ticket.id))!.statusId).toBe("default-in-progress");
    expect(created).toEqual([
      { title: `Implement ticket: ${ticket.shorthand}`, template: "implement-ticket", vars: { ticket: ticket.id } },
    ]);
  });
});

describe("updateWhenAttemptStatusCommand", () => {
  const workspacesContext = (storage: ReturnType<typeof createMemoryStorage>, id: string) =>
    makeCommandContext({
      storage,
      params: { id, allAttemptsStatus: "merged", setStatus: "Done" },
      overrides: {
        workspaces: {
          list: async () => [
            { id: "w1", workspace_shorthand: `${id}_A1` },
            { id: "w2", workspace_shorthand: `${id}_A2` },
          ],
        },
      } as never,
    });

  test("updates the ticket when every workspace matches", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    const ticket = await seedTicket(storage);
    await setWorkspaceStatusValue({ storage, workspaceId: "w1", status: "merged" });
    await setWorkspaceStatusValue({ storage, workspaceId: "w2", status: "merged" });

    const result = await updateWhenAttemptStatusCommand.run(workspacesContext(storage, ticket.shorthand));

    expect(result).toEqual({ updated: true, status: "Done" });
    expect((await ticketsCollection(storage).get(ticket.id))!.statusId).toBe("default-done");
  });

  test("leaves the ticket unchanged when a workspace does not match", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    const ticket = await seedTicket(storage);
    await setWorkspaceStatusValue({ storage, workspaceId: "w1", status: "merged" });
    await setWorkspaceStatusValue({ storage, workspaceId: "w2", status: "open" });

    const result = await updateWhenAttemptStatusCommand.run(workspacesContext(storage, ticket.shorthand));

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
            { id: "w1", workspace_shorthand: "T-1_A1", branch: "b1", worktree_path: "/wt/1" },
            { id: "w2", workspace_shorthand: "T-1_A2", branch: "b2", worktree_path: null },
            { id: "w3", workspace_shorthand: "T-2_A1", branch: "b3", worktree_path: "/wt/3" },
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
