import { describe, expect, mock, test } from "bun:test";
import { homedir } from "node:os";
import { deleteWorkspaceWithWorktree } from "./delete-workspace";
import { makeWorkspace } from "./workspace.test-fixture";

const baseDeps = {
  getWorkspace: async () => makeWorkspace({ workspace_shorthand: "PS-1_A1" }),
  deleteWorkspace: async () => {},
  removeWorktreeAndBranch: async () => {},
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

  test("logs error and continues when removeWorktreeAndBranch rejects", async () => {
    const log = mock();
    const removeWorktreeAndBranch = mock(async () => {
      throw new Error("worktree locked");
    });

    await deleteWorkspaceWithWorktree(
      { repoRoot: "/repo", projectId: "proj-1", workspaceShorthand: "PS-1_A1" },
      { ...baseDeps, removeWorktreeAndBranch, log },
    );

    const messages = log.mock.calls.map((call) => String(call[0]));
    expect(messages.some((msg) => msg.includes("worktree locked"))).toBe(true);
    expect(messages).toContain("Deleted workspace PS-1_A1");
  });
});
