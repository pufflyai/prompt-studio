import { describe, expect, mock, test } from "bun:test";
import { homedir } from "node:os";
import { join } from "node:path";
import { createWorkspaceForTicket } from "./create-workspace-for-ticket";

const mockTicket = {
  id: "t-1",
  shorthand: "PS-1",
  project_id: "proj-1",
  status_id: null,
  title: "Test",
  priority: null,
  complexity: null,
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
  worktree_path: join(homedir(), ".pstdio", "workspaces", "PS-1_A1"),
  status: "active",
  created_at: "2026-03-05T00:00:00.000Z",
  updated_at: "2026-03-05T00:00:00.000Z",
};

const baseDeps = {
  listTickets: async () => [mockTicket],
  createWorkspace: async () => mockWorkspace,
  createWorktree: async (_opts: { repoRoot: string; branch: string; path: string; base?: string }) => ({}),
  getStartupScript: async () => null as string | null,
  setStartupLog: mock(async () => ({ file_id: "f-1" })),
  exec: mock() as never,
  log: mock() as (...args: unknown[]) => void,
};

describe("createWorkspaceForTicket", () => {
  test("creates workspace with worktree", async () => {
    const log = mock();
    const createWorktree = mock(async () => {});
    const createWorkspace = mock(async () => mockWorkspace);

    const result = await createWorkspaceForTicket(
      { projectId: "proj-1", repoRoot: "/repo", ticketShorthand: "PS-1" },
      { ...baseDeps, createWorkspace, createWorktree, log },
    );

    expect(createWorkspace).toHaveBeenCalledTimes(1);
    expect(createWorktree).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(
      `Created workspace PS-1_A1 for PS-1 at ${join(homedir(), ".pstdio", "workspaces", "PS-1_A1")}`,
    );
    expect(result).toEqual(mockWorkspace);
  });

  test("throws when ticket not found", async () => {
    await expect(
      createWorkspaceForTicket(
        { projectId: "proj-1", repoRoot: "/repo", ticketShorthand: "PS-99" },
        { ...baseDeps, listTickets: async () => [] },
      ),
    ).rejects.toThrow("Ticket not found: PS-99");
  });

  test("uses base ref when provided", async () => {
    const createWorktree = mock(async () => {});

    await createWorkspaceForTicket(
      { projectId: "proj-1", repoRoot: "/repo", ticketShorthand: "PS-1", base: "main" },
      { ...baseDeps, createWorktree },
    );

    expect(createWorktree).toHaveBeenCalledWith({
      repoRoot: "/repo",
      branch: "workspace/PS-1_A1",
      path: join(homedir(), ".pstdio", "workspaces", "PS-1_A1"),
      base: "main",
    });
  });
});
