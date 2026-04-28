import { describe, expect, mock, test } from "bun:test";
import { createWorkspaceForTicket } from "./create-workspace-for-ticket";

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
  listPlannerTickets: async () => [mockTicket] as never,
  createWorkspace: async () => mockWorkspace as never,
  log: mock() as (...args: unknown[]) => void,
};

describe("createWorkspaceForTicket", () => {
  test("creates workspace linked to the planner ticket", async () => {
    const log = mock();
    const createWorkspace = mock(async () => mockWorkspace) as never;

    const result = await createWorkspaceForTicket(
      { projectId: "proj-1", repoRoot: "/repo", ticketShorthand: "PS-1" },
      { ...baseDeps, createWorkspace, log },
    );

    expect(createWorkspace).toHaveBeenCalledTimes(1);
    expect(createWorkspace).toHaveBeenCalledWith({
      project_id: "proj-1",
      name: "PS-1",
      branch: "workspace/PS-1",
      anchors: [
        {
          type: "pstdio.planner.ticket",
          id: "t-1",
          projectId: "proj-1",
          label: "PS-1",
          extensionId: "pstdio.planner",
          role: "primary",
          metadata: { base: "HEAD", repoRoot: "/repo" },
        },
      ],
    });
    expect(log).toHaveBeenCalledWith("Created workspace PS-1_A1 for PS-1 at /tmp/pstdio/workspaces/PS-1_A1");
    expect(result).toEqual(mockWorkspace as never);
  });

  test("throws when ticket not found", async () => {
    await expect(
      createWorkspaceForTicket(
        { projectId: "proj-1", repoRoot: "/repo", ticketShorthand: "PS-99" },
        { ...baseDeps, listPlannerTickets: async () => [] as never },
      ),
    ).rejects.toThrow("Ticket not found: PS-99");
  });

  test("uses base ref when provided", async () => {
    const createWorkspace = mock(async () => mockWorkspace) as never;

    await createWorkspaceForTicket(
      { projectId: "proj-1", repoRoot: "/repo", ticketShorthand: "PS-1", base: "main" },
      { ...baseDeps, createWorkspace },
    );

    expect(createWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({
        anchors: [expect.objectContaining({ metadata: { base: "main", repoRoot: "/repo" } })],
      }),
    );
  });
});
