import { describe, expect, mock, test } from "bun:test";
import { createHandler } from "./swap";

const baseDeps = {
  cwd: () => "/repo",
  findGitRoot: () => "/repo" as string | null,
  readConfig: () => ({ project_id: "proj-1" }) as { project_id: string } | null,
  getWorkspace: async () => null as never,
  readSwapState: () => null as never,
  writeSwapState: mock(() => {}),
  removeSwapState: mock(() => {}),
  isCleanWorkingTree: async () => true,
  getCurrentBranchOrCommit: async () => "main",
  getCommitHash: async () => "abc123",
  checkoutBranch: mock(async () => {}),
  deleteBranch: mock(async () => {}),
  log: mock(),
};

describe("workspace swap", () => {
  test("swap --id checks out preview branch", async () => {
    const log = mock();
    const writeSwapState = mock(() => {});
    const checkoutBranch = mock(async () => {});

    const handler = createHandler({
      ...baseDeps,
      getWorkspace: async () => ({
        id: "ws-1",
        project_id: "proj-1",
        name: "PS-1/A1",
        workspace_shorthand: "PS-1/A1",
        branch: "workspace/PS-1/A1",
        worktree_path: "/repo/.pstdio/workspaces/PS-1/A1",
        status: "active",
        created_at: "",
        updated_at: "",
      }),
      readSwapState: () => null,
      writeSwapState,
      checkoutBranch,
      log,
    });

    await handler({ id: "PS-1/A1", _: [], $0: "" } as never);

    expect(writeSwapState).toHaveBeenCalledTimes(1);
    expect(checkoutBranch).toHaveBeenCalledWith("/repo", "preview/PS-1/A1", "abc123");
    expect(log).toHaveBeenCalledWith("Swapped to workspace PS-1/A1");
  });

  test("swap --status shows active swap", async () => {
    const log = mock();

    const handler = createHandler({
      ...baseDeps,
      readSwapState: () => ({
        workspace_shorthand: "PS-1/A1",
        original_branch: "main",
        original_commit: "abc123",
        preview_branch: "preview/PS-1/A1",
      }),
      log,
    });

    await handler({ status: true, _: [], $0: "" } as never);

    expect(log).toHaveBeenCalledWith("Swap active: workspace PS-1/A1 on branch preview/PS-1/A1");
  });

  test("swap --status shows no swap message", async () => {
    const log = mock();

    const handler = createHandler({
      ...baseDeps,
      readSwapState: () => null,
      log,
    });

    await handler({ status: true, _: [], $0: "" } as never);

    expect(log).toHaveBeenCalledWith("No active swap.");
  });

  test("swap --back restores original branch", async () => {
    const log = mock();
    const checkoutBranch = mock(async () => {});
    const removeSwapState = mock(() => {});
    const deleteBranch = mock(async () => {});

    const handler = createHandler({
      ...baseDeps,
      readSwapState: () => ({
        workspace_shorthand: "PS-1/A1",
        original_branch: "main",
        original_commit: "abc123",
        preview_branch: "preview/PS-1/A1",
      }),
      checkoutBranch,
      removeSwapState,
      deleteBranch,
      log,
    });

    await handler({ back: true, _: [], $0: "" } as never);

    expect(checkoutBranch).toHaveBeenCalledWith("/repo", "main");
    expect(deleteBranch).toHaveBeenCalledWith("/repo", "preview/PS-1/A1");
    expect(removeSwapState).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("Restored original branch and cleared swap state.");
  });

  test("throws when multiple flags provided", async () => {
    const handler = createHandler(baseDeps);

    await expect(handler({ id: "PS-1/A1", status: true, _: [], $0: "" } as never)).rejects.toThrow(
      "Exactly one of --id, --status, --back is required",
    );
  });

  test("throws when swap --id with dirty working tree", async () => {
    const handler = createHandler({
      ...baseDeps,
      isCleanWorkingTree: async () => false,
      readSwapState: () => null,
      getWorkspace: async () => ({}) as never,
    });

    await expect(handler({ id: "PS-1/A1", _: [], $0: "" } as never)).rejects.toThrow("Branch has uncommitted changes");
  });

  test("throws when swap --id while already swapped", async () => {
    const handler = createHandler({
      ...baseDeps,
      readSwapState: () => ({
        workspace_shorthand: "PS-1/A1",
        original_branch: "main",
        original_commit: "abc",
        preview_branch: "preview/PS-1/A1",
      }),
    });

    await expect(handler({ id: "PS-1/A2", _: [], $0: "" } as never)).rejects.toThrow(
      "Already swapped - run 'workspace swap --back' first",
    );
  });
});
