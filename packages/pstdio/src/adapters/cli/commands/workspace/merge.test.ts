import { describe, expect, mock, test } from "bun:test";
import { createHandler } from "./merge";

const makeWorkspace = (shorthand: string) => ({
  id: "ws-1",
  project_id: "proj-1",
  name: shorthand,
  workspace_shorthand: shorthand,
  branch: `workspace/${shorthand}`,
  worktree_path: `/repo/.pstdio/workspaces/${shorthand}`,
  status: "active" as const,
  created_at: "",
  updated_at: "",
});

describe("workspace merge", () => {
  test("squash-merges workspace into current branch", async () => {
    const log = mock();
    const squashMerge = mock(async () => {});

    const handler = createHandler({
      cwd: () => "/repo",
      findGitRoot: () => "/repo",
      readConfig: () => ({ project_id: "proj-1" }),
      getWorkspace: async () => makeWorkspace("PS-1/A1"),
      deleteWorkspace: async () => {},
      isCleanWorkingTree: async () => true,
      squashMerge,
      abortMerge: async () => {},
      removeWorktree: async () => {},
      deleteBranch: async () => {},
      log,
    });

    await handler({ id: "PS-1/A1", _: [], $0: "" } as never);

    expect(squashMerge).toHaveBeenCalledWith("/repo", "workspace/PS-1/A1", "workspace(PS-1/A1): squash merge");
    expect(log).toHaveBeenCalledWith("Merged workspace PS-1/A1 as a squash commit.");
  });

  test("deletes workspace when --delete-workspace is set", async () => {
    const log = mock();
    const deleteWorkspace = mock(async () => {});
    const removeWorktree = mock(async () => {});
    const deleteBranch = mock(async () => {});

    const handler = createHandler({
      cwd: () => "/repo",
      findGitRoot: () => "/repo",
      readConfig: () => ({ project_id: "proj-1" }),
      getWorkspace: async () => makeWorkspace("PS-1/A1"),
      deleteWorkspace,
      isCleanWorkingTree: async () => true,
      squashMerge: async () => {},
      abortMerge: async () => {},
      removeWorktree,
      deleteBranch,
      log,
    });

    await handler({ id: "PS-1/A1", "delete-workspace": true, _: [], $0: "" } as never);

    expect(deleteWorkspace).toHaveBeenCalledTimes(1);
    expect(removeWorktree).toHaveBeenCalledTimes(1);
    expect(deleteBranch).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("Merged workspace PS-1/A1 and deleted workspace.");
  });

  test("aborts and throws on merge conflict", async () => {
    const abortMerge = mock(async () => {});

    const handler = createHandler({
      cwd: () => "/repo",
      findGitRoot: () => "/repo",
      readConfig: () => ({ project_id: "proj-1" }),
      getWorkspace: async () => makeWorkspace("PS-1/A1"),
      deleteWorkspace: async () => {},
      isCleanWorkingTree: async () => true,
      squashMerge: async () => {
        throw new Error("conflict");
      },
      abortMerge,
      removeWorktree: async () => {},
      deleteBranch: async () => {},
      log: () => {},
    });

    await expect(handler({ id: "PS-1/A1", _: [], $0: "" } as never)).rejects.toThrow("Merge conflict");
    expect(abortMerge).toHaveBeenCalledTimes(1);
  });

  test("throws on dirty working tree", async () => {
    const handler = createHandler({
      cwd: () => "/repo",
      findGitRoot: () => "/repo",
      readConfig: () => ({ project_id: "proj-1" }),
      getWorkspace: async () => makeWorkspace("PS-1/A1"),
      deleteWorkspace: async () => {},
      isCleanWorkingTree: async () => false,
      squashMerge: async () => {},
      abortMerge: async () => {},
      removeWorktree: async () => {},
      deleteBranch: async () => {},
      log: () => {},
    });

    await expect(handler({ id: "PS-1/A1", _: [], $0: "" } as never)).rejects.toThrow("Branch has uncommitted changes");
  });
});
