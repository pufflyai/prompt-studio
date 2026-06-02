import { describe, expect, mock, test } from "bun:test";
import type { Workspace } from "@pstdio/sdk/resources";
import { mergeWorkspace } from "./merge-workspace";

const makeWorkspace = (shorthand: string): Workspace => ({
  id: "ws-1",
  project_id: "proj-1",
  name: shorthand,
  branch: `workspace/${shorthand}`,
  worktree_path: `~/.pstdio/workspaces/${shorthand}`,
  is_default: false,
  attempt_status_id: null,
  archived: false,
  workspace_shorthand: shorthand,
  startup_log_file_id: null,
  created_at: "",
  updated_at: "",
  deleted_at: null,
});

const baseDeps = {
  getWorkspace: async () => makeWorkspace("PS-1_A1") as never,
  deleteWorkspace: async () => {},
  isCleanWorkingTree: async () => true,
  squashMerge: async () => {},
  abortMerge: async () => {},
  removeWorktreeAndBranch: async () => {},
  log: () => {},
};

describe("mergeWorkspace", () => {
  test("squash-merges workspace", async () => {
    const log = mock();
    const squashMerge = mock(async () => {});

    await mergeWorkspace(
      { repoRoot: "/repo", projectId: "proj-1", workspaceShorthand: "PS-1_A1" },
      { ...baseDeps, squashMerge, log },
    );

    expect(squashMerge).toHaveBeenCalledWith("/repo", "workspace/PS-1_A1", "workspace(PS-1_A1): squash merge");
    expect(log).toHaveBeenCalledWith("Merged workspace PS-1_A1 as a squash commit.");
  });

  test("deletes workspace when deleteAfter is true", async () => {
    const log = mock();
    const deleteWorkspace = mock(async () => {});
    const removeWorktreeAndBranch = mock(async () => {});

    await mergeWorkspace(
      { repoRoot: "/repo", projectId: "proj-1", workspaceShorthand: "PS-1_A1", deleteAfter: true },
      { ...baseDeps, deleteWorkspace, removeWorktreeAndBranch, log },
    );

    expect(deleteWorkspace).toHaveBeenCalledTimes(1);
    expect(removeWorktreeAndBranch).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("Merged workspace PS-1_A1 and deleted workspace.");
  });

  test("aborts and throws on merge conflict", async () => {
    const abortMerge = mock(async () => {});

    await expect(
      mergeWorkspace(
        { repoRoot: "/repo", projectId: "proj-1", workspaceShorthand: "PS-1_A1" },
        {
          ...baseDeps,
          squashMerge: async () => {
            throw new Error("conflict");
          },
          abortMerge,
        },
      ),
    ).rejects.toThrow("Merge conflict");
    expect(abortMerge).toHaveBeenCalledTimes(1);
  });

  test("throws on dirty working tree", async () => {
    await expect(
      mergeWorkspace(
        { repoRoot: "/repo", projectId: "proj-1", workspaceShorthand: "PS-1_A1" },
        { ...baseDeps, isCleanWorkingTree: async () => false },
      ),
    ).rejects.toThrow("Branch has uncommitted changes");
  });

  test("throws when workspace not found", async () => {
    await expect(
      mergeWorkspace(
        { repoRoot: "/repo", projectId: "proj-1", workspaceShorthand: "PS-1_A99" },
        { ...baseDeps, getWorkspace: async () => null },
      ),
    ).rejects.toThrow("Workspace not found: PS-1_A99");
  });
});
