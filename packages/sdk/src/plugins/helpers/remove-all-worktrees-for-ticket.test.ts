import { describe, expect, it } from "bun:test";
import { removeAllWorktreesForTicket } from "./remove-all-worktrees-for-ticket";

describe("removeAllWorktreesForTicket", () => {
  it("removes all worktrees linked to a ticket", async () => {
    const removedWorktreeIds: string[] = [];

    const ctx = {
      projectId: "proj-1",
      client: {
        tickets: {
          list: async () => [{ id: "ticket-1", shorthand: "PS-1" }],
        },
        workspaces: {
          list: async () => [
            { id: "ws-1", ticket_shorthand: "PS-1", worktree_path: "/wt/PS-1_A1" },
            { id: "ws-2", ticket_shorthand: "PS-2", worktree_path: "/wt/PS-2_A1" },
            { id: "ws-3", ticket_shorthand: "PS-1", worktree_path: "/wt/PS-1_A2" },
          ],
          removeWorktree: async (workspaceId: string) => {
            removedWorktreeIds.push(workspaceId);
            return { removed: true };
          },
        },
      },
    } as never;

    const removed = await removeAllWorktreesForTicket(ctx, { ticketId: "ticket-1" });

    expect(removed).toBe(2);
    expect(removedWorktreeIds).toEqual(["ws-1", "ws-3"]);
  });

  it("removes all worktrees linked to a ticket shorthand passed as ticketId", async () => {
    const removedWorktreeIds: string[] = [];

    const ctx = {
      projectId: "proj-1",
      client: {
        tickets: {
          list: async () => [{ id: "ticket-1", shorthand: "PS-1" }],
        },
        workspaces: {
          list: async () => [
            { id: "ws-1", ticket_shorthand: "PS-1", worktree_path: "/wt/PS-1_A1" },
            { id: "ws-2", ticket_shorthand: "PS-2", worktree_path: "/wt/PS-2_A1" },
            { id: "ws-3", ticket_shorthand: "PS-1", worktree_path: "/wt/PS-1_A2" },
          ],
          removeWorktree: async (workspaceId: string) => {
            removedWorktreeIds.push(workspaceId);
            return { removed: true };
          },
        },
      },
    } as never;

    const removed = await removeAllWorktreesForTicket(ctx, { ticketId: "PS-1" });

    expect(removed).toBe(2);
    expect(removedWorktreeIds).toEqual(["ws-1", "ws-3"]);
  });

  it("continues removing worktrees when one removal fails", async () => {
    const attemptedWorkspaceIds: string[] = [];

    const ctx = {
      projectId: "proj-1",
      client: {
        tickets: {
          list: async () => [{ id: "ticket-1", shorthand: "PS-1" }],
        },
        workspaces: {
          list: async () => [
            { id: "ws-1", ticket_shorthand: "PS-1", worktree_path: "/wt/PS-1_A1" },
            { id: "ws-2", ticket_shorthand: "PS-1", worktree_path: "/wt/PS-1_A2" },
          ],
          removeWorktree: async (workspaceId: string) => {
            attemptedWorkspaceIds.push(workspaceId);
            if (workspaceId === "ws-1") {
              throw new Error("remove failed");
            }
            return { removed: true };
          },
        },
      },
    } as never;

    const removed = await removeAllWorktreesForTicket(ctx, { ticketId: "ticket-1" });

    expect(removed).toBe(1);
    expect(attemptedWorkspaceIds).toEqual(["ws-1", "ws-2"]);
  });
});
