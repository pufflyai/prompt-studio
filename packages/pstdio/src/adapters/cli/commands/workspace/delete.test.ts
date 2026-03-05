import { describe, expect, mock, test } from "bun:test";
import { createHandler } from "./delete";

const makeWorkspace = (shorthand: string) => ({
  id: "ws-1",
  project_id: "proj-1",
  name: shorthand,
  workspace_shorthand: shorthand,
  branch: `workspace/${shorthand}`,
  worktree_path: `/repo/.pstdio/workspaces/${shorthand}`,
  status: "active" as const,
  created_at: "2026-03-05T00:00:00.000Z",
  updated_at: "2026-03-05T00:00:00.000Z",
});

describe("workspace delete", () => {
  test("deletes workspace, worktree, and branch", async () => {
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
      removeWorktree,
      deleteBranch,
      readSwapState: () => null,
      removeSwapState: () => {},
      checkoutBranch: async () => {},
      log,
    });

    await handler({ id: "PS-1/A1", _: [], $0: "" } as never);

    expect(deleteWorkspace).toHaveBeenCalledTimes(1);
    expect(removeWorktree).toHaveBeenCalledTimes(1);
    expect(deleteBranch).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("Deleted workspace PS-1/A1");
  });

  test("swaps back before deleting if workspace is swapped", async () => {
    const log = mock();
    const checkoutBranch = mock(async () => {});
    const removeSwapState = mock(() => {});
    const deleteBranch = mock(async () => {});

    const handler = createHandler({
      cwd: () => "/repo",
      findGitRoot: () => "/repo",
      readConfig: () => ({ project_id: "proj-1" }),
      getWorkspace: async () => makeWorkspace("PS-1/A1"),
      deleteWorkspace: async () => {},
      removeWorktree: async () => {},
      deleteBranch,
      readSwapState: () => ({
        workspace_shorthand: "PS-1/A1",
        original_branch: "main",
        original_commit: "abc123",
        preview_branch: "preview/PS-1/A1",
      }),
      removeSwapState,
      checkoutBranch,
      log,
    });

    await handler({ id: "PS-1/A1", _: [], $0: "" } as never);

    expect(checkoutBranch).toHaveBeenCalledWith("/repo", "main");
    expect(removeSwapState).toHaveBeenCalledTimes(1);
  });

  test("throws when workspace not found", async () => {
    const handler = createHandler({
      cwd: () => "/repo",
      findGitRoot: () => "/repo",
      readConfig: () => ({ project_id: "proj-1" }),
      getWorkspace: async () => null,
      deleteWorkspace: async () => {},
      removeWorktree: async () => {},
      deleteBranch: async () => {},
      readSwapState: () => null,
      removeSwapState: () => {},
      checkoutBranch: async () => {},
      log: () => {},
    });

    await expect(handler({ id: "PS-1/A99", _: [], $0: "" } as never)).rejects.toThrow("Workspace not found: PS-1/A99");
  });
});
