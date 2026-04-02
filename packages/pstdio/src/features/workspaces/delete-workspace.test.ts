import { describe, expect, mock, test } from "bun:test";
import { homedir } from "node:os";
import type { HookName, HookPayload, HookResult, RunHookOptions } from "pstdio-hooks";
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

const skippedHookResult = (hookName: HookName): HookResult => ({
  hook: hookName,
  skipped: true,
  exitCode: 0,
  stdout: "",
  stderr: "",
});

const baseDeps = {
  getWorkspace: async () => makeWorkspace("PS-1_A1"),
  deleteWorkspace: async () => {},
  removeWorktreeAndBranch: async () => {},
  runHook: async (hookName: HookName, _payload: HookPayload, _options: RunHookOptions) => skippedHookResult(hookName),
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

  test("passes flat payload to remove hooks", async () => {
    const runHook = mock(
      async (hookName: HookName, _payload: HookPayload, _options: RunHookOptions): Promise<HookResult> => ({
        hook: hookName,
        skipped: false,
        exitCode: 0,
        stdout: "",
        stderr: "",
      }),
    );

    await deleteWorkspaceWithWorktree(
      { repoRoot: "/repo", projectId: "proj-1", workspaceShorthand: "PS-1_A1" },
      { ...baseDeps, runHook },
    );

    expect(runHook).toHaveBeenCalledTimes(2);

    const prePayload = runHook.mock.calls[0]?.[1];
    const postPayload = runHook.mock.calls[1]?.[1];

    expect(prePayload).toEqual({
      repo_path: "/repo",
      worktree_path: `${homedir()}/.pstdio/workspaces/PS-1_A1`,
      branch: "workspace/PS-1_A1",
      workspace: "PS-1_A1",
      workspace_id: "ws-1",
      ticket: "PS-1",
      project_id: "proj-1",
    });

    // post-remove has worktree_path set to null since worktree is deleted
    expect(postPayload).toEqual({ ...prePayload, worktree_path: null });
  });
});
