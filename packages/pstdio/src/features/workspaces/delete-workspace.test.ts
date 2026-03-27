import { describe, expect, mock, test } from "bun:test";
import { homedir } from "node:os";
import { deleteWorkspaceWithWorktree } from "./delete-workspace";

const makeWorkspace = (shorthand: string) => ({
  id: "ws-1",
  project_id: "proj-1",
  name: shorthand,
  workspace_shorthand: shorthand,
  branch: `workspace/${shorthand}`,
  worktree_path: `${homedir()}/.pstdio/workspaces/${shorthand}`,
  status: "active" as const,
  created_at: "2026-03-05T00:00:00.000Z",
  updated_at: "2026-03-05T00:00:00.000Z",
});

const baseDeps = {
  getWorkspace: async () => makeWorkspace("PS-1_A1"),
  deleteWorkspace: async () => {},
  removeWorktreeAndBranch: async () => {},
  runHook: async (hookName: "pre-worktree-remove" | "post-worktree-remove") =>
    ({ hook: hookName, skipped: true, exitCode: 0, stdout: "", stderr: "" }) as const,
  log: () => {},
};

describe("deleteWorkspaceWithWorktree", () => {
  test("deletes workspace and removes worktree with branch", async () => {
    const log = mock();
    const deleteWorkspace = mock(async () => {});
    const removeWorktreeAndBranch = mock(async () => {});

    await deleteWorkspaceWithWorktree(
      { repoRoot: "/repo", projectId: "proj-1", workspaceShorthand: "PS-1_A1" },
      { ...baseDeps, deleteWorkspace, removeWorktreeAndBranch, log },
    );

    expect(deleteWorkspace).toHaveBeenCalledTimes(1);
    expect(removeWorktreeAndBranch).toHaveBeenCalledTimes(1);
    expect(removeWorktreeAndBranch).toHaveBeenCalledWith({
      repoRoot: "/repo",
      path: `${homedir()}/.pstdio/workspaces/PS-1_A1`,
      branch: "workspace/PS-1_A1",
      force: true,
    });
    expect(log).toHaveBeenCalledWith("Deleted workspace PS-1_A1");
  });

  test("throws when workspace not found", async () => {
    await expect(
      deleteWorkspaceWithWorktree(
        { repoRoot: "/repo", projectId: "proj-1", workspaceShorthand: "PS-1_A99" },
        { ...baseDeps, getWorkspace: async () => null },
      ),
    ).rejects.toThrow("Workspace not found: PS-1_A99");
  });
});
