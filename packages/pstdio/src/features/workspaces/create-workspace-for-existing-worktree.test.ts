import { describe, expect, mock, test } from "bun:test";
import { createWorkspaceForExistingWorktree } from "./create-workspace-for-existing-worktree";

const mockTicket = {
  id: "t-1",
  shorthand: "PS-1",
  project_id: "proj-1",
  status_id: null,
  display_title: "Test",
  file_id: null,
  draft: false,
  archived: false,
  status_name: null,
  tag_names: [],
  created_at: "2026-03-05T00:00:00.000Z",
};

const mockWorkspace = {
  id: "ws-1",
  project_id: "proj-1",
  name: "PS-1_A1",
  workspace_shorthand: "PS-1_A1",
  branch: "workspace/PS-1_A1",
  worktree_path: "/tmp/pstdio/workspaces/PS-1_A1",
  status: "active",
  created_at: "2026-03-05T00:00:00.000Z",
  updated_at: "2026-03-05T00:00:00.000Z",
};

const baseDeps = {
  listTickets: async () => [mockTicket] as never,
  createWorkspace: async () => mockWorkspace as never,
  log: mock() as (...args: unknown[]) => void,
};

describe("createWorkspaceForExistingWorktree", () => {
  test("creates a workspace record linked to an existing worktree", async () => {
    const createWorkspace = mock(async () => mockWorkspace) as never;
    const log = mock();

    const result = await createWorkspaceForExistingWorktree(
      {
        branch: "workspace/PS-1_A1",
        projectId: "proj-1",
        ticketShorthand: "PS-1",
        worktreePath: "/tmp/pstdio/workspaces/PS-1_A1",
      },
      { ...baseDeps, createWorkspace, log },
    );

    expect(createWorkspace).toHaveBeenCalledWith({
      project_id: "proj-1",
      ticket_id: "t-1",
      ticket_shorthand: "PS-1",
      branch: "workspace/PS-1_A1",
      worktree_path: "/tmp/pstdio/workspaces/PS-1_A1",
    });
    expect(log).toHaveBeenCalledWith("Created workspace PS-1_A1 for PS-1 linked to /tmp/pstdio/workspaces/PS-1_A1");
    expect(result).toEqual(mockWorkspace as never);
  });

  test("throws when ticket not found", async () => {
    await expect(
      createWorkspaceForExistingWorktree(
        {
          branch: "workspace/PS-99_A1",
          projectId: "proj-1",
          ticketShorthand: "PS-99",
          worktreePath: "/tmp/pstdio/workspaces/PS-99_A1",
        },
        { ...baseDeps, listTickets: async () => [] as never },
      ),
    ).rejects.toThrow("Ticket not found: PS-99");
  });
});
