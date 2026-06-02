import { describe, expect, mock, test } from "bun:test";
import { homedir } from "node:os";
import type { Workspace } from "@pstdio/sdk/resources";
import { deleteWorkspaceWithWorktree } from "./delete-workspace";

const makeWorkspace = (shorthand: string): Workspace => ({
  id: "ws-1",
  project_id: "proj-1",
  name: shorthand,
  branch: `workspace/${shorthand}`,
  worktree_path: `${homedir()}/.pstdio/workspaces/${shorthand}`,
  is_default: false,
  attempt_status_id: null,
  archived: false,
  workspace_shorthand: shorthand,
  startup_log_file_id: null,
  created_at: "2026-03-05T00:00:00.000Z",
  updated_at: "2026-03-05T00:00:00.000Z",
  deleted_at: null,
});

const baseDeps = {
  getWorkspace: async () => makeWorkspace("PS-1_A1"),
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
