import { describe, expect, mock, test } from "bun:test";
import type { Workspace } from "@/features/workspaces/types";
import { createHandler } from "./create";

const mockWorkspace: Workspace = {
  id: "ws-1",
  project_id: "proj-1",
  name: "PS-1_A1",
  workspace_shorthand: "PS-1_A1",
  branch: "workspace/PS-1_A1",
  worktree_path: null,
  created_at: "2026-03-05T00:00:00.000Z",
  updated_at: "2026-03-05T00:00:00.000Z",
};

const baseDeps = {
  cwd: () => "/repo",
  findGitRoot: () => "/repo" as string | null,
  readConfig: () => ({ project_id: "proj-1" }) as { project_id: string } | null,
  createWorkspaceForTicket: mock(async () => mockWorkspace) as never,
  createWorkspaceForExistingWorktree: mock(async () => mockWorkspace) as never,
  resolveCurrentBranch: () => "workspace/PS-1_A1",
};

describe("workspaces create", () => {
  test("delegates to createWorkspaceForTicket", async () => {
    const createWorkspaceForTicket = mock(async () => mockWorkspace) as never;

    const handler = createHandler({ ...baseDeps, createWorkspaceForTicket });
    await handler({ id: "PS-1", target: "worktree", _: [], $0: "" } as never);

    expect(createWorkspaceForTicket).toHaveBeenCalledWith({
      projectId: "proj-1",
      repoRoot: "/repo",
      ticketShorthand: "PS-1",
      base: undefined,
    });
  });

  test("passes base ref to feature function", async () => {
    const createWorkspaceForTicket = mock(async () => mockWorkspace) as never;

    const handler = createHandler({ ...baseDeps, createWorkspaceForTicket });
    await handler({ id: "PS-1", target: "worktree", base: "main", _: [], $0: "" } as never);

    expect(createWorkspaceForTicket).toHaveBeenCalledWith({
      projectId: "proj-1",
      repoRoot: "/repo",
      ticketShorthand: "PS-1",
      base: "main",
    });
  });

  test("links an existing worktree when worktree path is provided", async () => {
    const createWorkspaceForTicket = mock(async () => mockWorkspace) as never;
    const createWorkspaceForExistingWorktree = mock(async () => mockWorkspace) as never;

    const handler = createHandler({ ...baseDeps, createWorkspaceForTicket, createWorkspaceForExistingWorktree });
    await handler({ id: "PS-1", target: "worktree", worktreePath: ".", _: [], $0: "" } as never);

    expect(createWorkspaceForTicket).not.toHaveBeenCalled();
    expect(createWorkspaceForExistingWorktree).toHaveBeenCalledWith({
      projectId: "proj-1",
      ticketShorthand: "PS-1",
      branch: "workspace/PS-1_A1",
      worktreePath: "/repo",
    });
  });

  test("uses explicit branch when linking an existing worktree", async () => {
    const createWorkspaceForExistingWorktree = mock(async () => mockWorkspace) as never;

    const handler = createHandler({ ...baseDeps, createWorkspaceForExistingWorktree });
    await handler({
      id: "PS-1",
      target: "worktree",
      branch: "workspace/manual",
      worktreePath: "/linked",
      _: [],
      $0: "",
    } as never);

    expect(createWorkspaceForExistingWorktree).toHaveBeenCalledWith({
      projectId: "proj-1",
      ticketShorthand: "PS-1",
      branch: "workspace/manual",
      worktreePath: "/repo",
    });
  });

  test("throws when base is provided with an existing worktree", async () => {
    const handler = createHandler(baseDeps);

    await expect(
      handler({ id: "PS-1", target: "worktree", base: "main", worktreePath: ".", _: [], $0: "" } as never),
    ).rejects.toThrow("Cannot use --base when linking an existing worktree.");
  });

  test("throws on invalid target", async () => {
    const handler = createHandler(baseDeps);
    await expect(handler({ id: "PS-1", target: "docker", _: [], $0: "" } as never)).rejects.toThrow(
      "Invalid target: docker. Must be 'worktree'.",
    );
  });

  test("throws when not in git repo", async () => {
    const handler = createHandler({ ...baseDeps, findGitRoot: () => null });
    await expect(handler({ id: "PS-1", target: "worktree", _: [], $0: "" } as never)).rejects.toThrow(
      "Not inside a git repository.",
    );
  });
});
