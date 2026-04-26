import { describe, expect, mock, test } from "bun:test";
import { homedir } from "node:os";
import type { Workspace } from "@pstdio/sdk/resources";
import type { loadPluginRuntime as loadPluginRuntimeFn, PluginRuntime } from "pstdio-plugins/hooks";
import { createHookDispatcher } from "pstdio-plugins/hooks";
import { deleteWorkspaceWithWorktree } from "./delete-workspace";

const flushMicrotasks = async () => Promise.resolve();

const makeWorkspace = (shorthand: string): Workspace => ({
  id: "ws-1",
  project_id: "proj-1",
  name: shorthand,
  branch: `workspace/${shorthand}`,
  worktree_path: `${homedir()}/.pstdio/workspaces/${shorthand}`,
  attempt_status_id: null,
  archived: false,
  workspace_shorthand: shorthand,
  startup_log_file_id: null,
  created_at: "2026-03-05T00:00:00.000Z",
  updated_at: "2026-03-05T00:00:00.000Z",
  deleted_at: null,
});

const makeRuntimeMock = (overrides?: Partial<PluginRuntime["hooks"]>): PluginRuntime => ({
  repoPath: "/repo",
  client: {} as PluginRuntime["client"],
  plugins: [],
  hooks: {
    firePre: async () => ({ rejected: false }),
    firePost: async () => {},
    ...overrides,
  },
  actions: {
    list: () => [],
    get: () => undefined,
  },
  schedules: {
    list: () => [],
    get: () => undefined,
    trigger: async () => {},
  },
});

const loadPluginRuntimeMock = mock<typeof loadPluginRuntimeFn>(async () => makeRuntimeMock());

const baseDeps = {
  getWorkspace: async () => makeWorkspace("PS-1_A1"),
  deleteWorkspace: async () => {},
  removeWorktreeAndBranch: async () => {},
  loadPluginRuntime: loadPluginRuntimeMock,
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

  test("passes context to dispatch hooks", async () => {
    const firePreHook = mock(async () => ({ rejected: false }));
    const firePostHook = mock(async () => {});
    const dispatch = { firePreHook, firePostHook };

    await deleteWorkspaceWithWorktree(
      { repoRoot: "/repo", projectId: "proj-1", workspaceShorthand: "PS-1_A1" },
      { ...baseDeps, dispatch },
    );

    expect(firePreHook).toHaveBeenCalledTimes(1);
    expect(firePreHook).toHaveBeenCalledWith(
      "preWorktreeRemove",
      expect.objectContaining({ repo_path: "/repo", workspace: "PS-1_A1", ticket: "PS-1" }),
    );

    expect(firePostHook).toHaveBeenCalledTimes(1);
    expect(firePostHook).toHaveBeenCalledWith(
      "postWorktreeRemove",
      expect.objectContaining({ workspace: "PS-1_A1", worktree_path: null }),
      expect.any(Function),
    );
  });

  test("logs post-hook errors instead of swallowing them", async () => {
    const dispatch = createHookDispatcher();
    const log = mock();

    dispatch.register("postWorktreeRemove", () => {
      throw new Error("post-hook failed");
    });

    await deleteWorkspaceWithWorktree(
      { repoRoot: "/repo", projectId: "proj-1", workspaceShorthand: "PS-1_A1" },
      { ...baseDeps, dispatch, log },
    );

    await flushMicrotasks();

    expect(log).toHaveBeenCalledWith("Deleted workspace PS-1_A1");
    expect(log).toHaveBeenCalledWith(expect.stringContaining("postWorktreeRemove hook failed"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("post-hook failed"));
  });

  test("logs post-hook errors through the default runtime-backed dispatch", async () => {
    const log = mock();
    loadPluginRuntimeMock.mockImplementationOnce(async () =>
      makeRuntimeMock({
        firePre: async () => ({ rejected: false }),
        firePost: async (_hookName: string, _ctx: unknown, onError?: (message: string) => void) => {
          onError?.("runtime post-hook failed");
        },
      }),
    );

    await deleteWorkspaceWithWorktree(
      { repoRoot: "/repo", projectId: "proj-1", workspaceShorthand: "PS-1_A1" },
      { ...baseDeps, log },
    );

    await flushMicrotasks();

    expect(log).toHaveBeenCalledWith("Deleted workspace PS-1_A1");
    expect(log).toHaveBeenCalledWith("postWorktreeRemove hook failed: runtime post-hook failed");
  });
});
