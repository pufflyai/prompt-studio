import { describe, expect, mock, test } from "bun:test";
import { createHandler } from "./workspaces";

const ticketFixture = {
  id: "ticket-1",
  shorthand: "PS-1",
  project_id: "proj-1",
  status_id: null,
  display_title: "Ticket",
  file_id: null,
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
      resolveTicketByShorthand: async () => ticketFixture as never,
      listWorkspaces: async () =>
        [
          {
            id: "ws-1",
            workspace_shorthand: "PS-1_A1",
            ticket_shorthand: "PS-1",
            branch: "workspace/PS-1_A1",
            worktree_path: "/repo/.pstdio/workspaces/PS-1_A1",
            attempt_status_id: null,
            attempt_status_name: null,
          },
          {
            id: "ws-2",
            workspace_shorthand: "PS-2_A1",
            ticket_shorthand: "PS-2",
            branch: "workspace/PS-2_A1",
            worktree_path: "/repo/.pstdio/workspaces/PS-2_A1",
            attempt_status_id: null,
            attempt_status_name: null,
          },
        ] as never,
      log,
    });

    await handler({ id: "PS-1", _: [], $0: "" } as never);

    const table = log.mock.calls[0]?.[0] as string;
    expect(table).toContain("Workspace");
    expect(table).toContain("PS-1_A1");
    expect(table).not.toContain("PS-2_A1");
  });

  test("outputs JSON when --json flag is set", async () => {
    const log = mock();
    const handler = createHandler({
      cwd: () => "/repo",
      resolveProjectId: () => ({ projectId: "proj-1", root: "/repo" }),
      resolveTicketByShorthand: async () => ticketFixture as never,
      listWorkspaces: async () =>
        [
          {
            id: "ws-1",
            workspace_shorthand: "PS-1_A1",
            ticket_shorthand: "PS-1",
            branch: "workspace/PS-1_A1",
            worktree_path: "/repo/.pstdio/workspaces/PS-1_A1",
            attempt_status_id: "as-1",
            attempt_status_name: "reviewed",
          },
        ] as never,
      log,
    });

    await handler({ id: "PS-1", json: true, _: [], $0: "" } as never);

    const output = JSON.parse(log.mock.calls[0]?.[0] as string);
    expect(output).toBeArray();
    expect(output[0].workspace_shorthand).toBe("PS-1_A1");
    expect(output[0].attempt_status_name).toBe("reviewed");
    expect(output[0].workspace_id).toBe("ws-1");
  });

  test("prints empty state when ticket has no active workspaces", async () => {
    const log = mock();
    const handler = createHandler({
      cwd: () => "/repo",
      resolveProjectId: () => ({ projectId: "proj-1", root: "/repo" }),
      resolveTicketByShorthand: async () => ticketFixture as never,
      listWorkspaces: async () =>
        [
          {
            id: "ws-2",
            workspace_shorthand: "PS-2_A1",
            ticket_shorthand: "PS-2",
            branch: "workspace/PS-2_A1",
            worktree_path: "/repo/.pstdio/workspaces/PS-2_A1",
            attempt_status_id: null,
            attempt_status_name: null,
          },
        ] as never,
      log,
    });

    await handler({ id: "PS-1", _: [], $0: "" } as never);

    expect(log).toHaveBeenCalledWith("No ticket workspaces found.");
  });
});
