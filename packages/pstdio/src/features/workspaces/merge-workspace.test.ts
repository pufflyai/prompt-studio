import { describe, expect, mock, test } from "bun:test";
import { homedir } from "node:os";
import { mergeWorkspace } from "./merge-workspace";
import { makeWorkspace } from "./workspace.test-fixture";

const baseDeps = {
  getWorkspace: async () => makeWorkspace({ workspace_shorthand: "PS-1_A1" }) as never,
  deleteWorkspace: async () => {},
  isCleanWorkingTree: async () => true,
  squashMerge: async () => {},
  abortMerge: async () => {},
  removeWorktreeAndBranch: async () => {},
  fireGitMerged: async () => {},
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

  test("fires git merged event after squash merge", async () => {
    const fireGitMerged = mock(async () => {});

    await mergeWorkspace(
      { repoRoot: "/repo", projectId: "proj-1", workspaceShorthand: "PS-1_A1" },
      { ...baseDeps, fireGitMerged },
    );

    expect(fireGitMerged).toHaveBeenCalledWith("proj-1", {
      projectId: "proj-1",
      repoPath: "/repo",
      worktreePath: `${homedir()}/.pstdio/workspaces/PS-1_A1`,
      branch: "workspace/PS-1_A1",
      workspace: {
        id: "ws-1",
        name: "PS-1_A1",
        project_id: "proj-1",
        workspace_shorthand: "PS-1_A1",
        branch: "workspace/PS-1_A1",
        worktree_path: `${homedir()}/.pstdio/workspaces/PS-1_A1`,
        anchors_json: [],
        created_at: "2026-03-05T00:00:00.000Z",
        updated_at: "2026-03-05T00:00:00.000Z",
      },
      anchors: [],
    });
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

  test("does not fail or skip cleanup when git merged event dispatch fails", async () => {
    const calls: string[] = [];
    const log = mock((message: string) => calls.push(`log:${message}`));

    await mergeWorkspace(
      { repoRoot: "/repo", projectId: "proj-1", workspaceShorthand: "PS-1_A1", deleteAfter: true },
      {
        ...baseDeps,
        squashMerge: async () => {
          calls.push("squashMerge");
        },
        deleteWorkspace: async () => {
          calls.push("deleteWorkspace");
        },
        removeWorktreeAndBranch: async () => {
          calls.push("removeWorktreeAndBranch");
        },
        fireGitMerged: async () => {
          calls.push("fireGitMerged");
          throw new Error("dispatch failed");
        },
        log,
      },
    );

    expect(calls).toEqual([
      "squashMerge",
      "deleteWorkspace",
      "removeWorktreeAndBranch",
      "log:Merged workspace PS-1_A1 and deleted workspace.",
      "fireGitMerged",
      "log:Merged workspace, but git merged event dispatch failed: dispatch failed",
    ]);
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

  test("refuses to merge a remote workspace", async () => {
    const squashMerge = mock(async () => {});

    await expect(
      mergeWorkspace(
        { repoRoot: "/repo", projectId: "proj-1", workspaceShorthand: "PS-1_A1" },
        {
          ...baseDeps,
          getWorkspace: async () =>
            makeWorkspace({
              execution_kind: "remote",
              worktree_path: null,
              provider_capabilities_json: {
                files: "none",
                diff: false,
                merge: false,
                rebase: false,
                archive: true,
                delete: true,
              },
            }) as never,
          squashMerge,
        },
      ),
    ).rejects.toThrow(/cannot be merged/);

    expect(squashMerge).not.toHaveBeenCalled();
  });

  test("refuses to merge a root checkout", async () => {
    await expect(
      mergeWorkspace(
        { repoRoot: "/repo", projectId: "proj-1", workspaceShorthand: "default" },
        {
          ...baseDeps,
          getWorkspace: async () =>
            makeWorkspace({
              workspace_shorthand: "default",
              provider_id: "pstdio.root",
              branch: "main",
              worktree_path: null,
              is_default: true,
            }) as never,
        },
      ),
    ).rejects.toThrow(/cannot be merged/);
  });
});
