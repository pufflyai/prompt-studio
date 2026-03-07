import { describe, expect, mock, test } from "bun:test";
import { createHandler } from "./workspaces";

const ticketFixture = {
  id: "ticket-1",
  shorthand: "PS-1",
  project_id: "proj-1",
  status_id: null,
  title: "Ticket",
  priority: null,
  complexity: null,
  draft: false,
  archived: false,
  status_name: null,
  tag_names: [] as string[],
  created_at: "2026-03-05T00:00:00.000Z",
};

describe("tickets workspaces", () => {
  test("lists active workspaces linked to a ticket", async () => {
    const log = mock();
    const handler = createHandler({
      cwd: () => "/repo",
      resolveProjectId: () => ({ projectId: "proj-1", root: "/repo" }),
      resolveTicketByShorthand: async () => ticketFixture,
      listWorkspaces: async () => [
        {
          id: "ws-1",
          workspace_shorthand: "PS-1_A1",
          ticket_shorthand: "PS-1",
          branch: "workspace/PS-1_A1",
          worktree_path: "/repo/.pstdio/workspaces/PS-1_A1",
          status: "active",
        },
        {
          id: "ws-2",
          workspace_shorthand: "PS-2_A1",
          ticket_shorthand: "PS-2",
          branch: "workspace/PS-2_A1",
          worktree_path: "/repo/.pstdio/workspaces/PS-2_A1",
          status: "active",
        },
      ],
      log,
    });

    await handler({ id: "PS-1", _: [], $0: "" } as never);

    const table = log.mock.calls[0]?.[0] as string;
    expect(table).toContain("Workspace");
    expect(table).toContain("PS-1_A1");
    expect(table).not.toContain("PS-2_A1");
  });

  test("prints empty state when ticket has no active workspaces", async () => {
    const log = mock();
    const handler = createHandler({
      cwd: () => "/repo",
      resolveProjectId: () => ({ projectId: "proj-1", root: "/repo" }),
      resolveTicketByShorthand: async () => ticketFixture,
      listWorkspaces: async () => [
        {
          id: "ws-2",
          workspace_shorthand: "PS-2_A1",
          ticket_shorthand: "PS-2",
          branch: "workspace/PS-2_A1",
          worktree_path: "/repo/.pstdio/workspaces/PS-2_A1",
          status: "active",
        },
      ],
      log,
    });

    await handler({ id: "PS-1", _: [], $0: "" } as never);

    expect(log).toHaveBeenCalledWith("No ticket workspaces found.");
  });
});
