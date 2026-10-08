import { expect, mock, test } from "bun:test";
import { createCommandEnvironment } from "./index";

const makeEnabledSources = () => [
  {
    instance: {
      id: "instance-1",
      namespace: "lab",
    },
    installedSource: {
      id: "source-1",
      extension_id: "pstdio.extension-lab",
      source_path: "/tmp/extension-lab",
    },
  },
];

const projectContext = { id: "project-1", name: "Project One", shorthand: "PO" };

const makeStorageService = () => ({
  getKv: async () => null,
  setKv: async () => {},
  deleteKv: async () => {},
  getCollectionItem: async () => null,
  listCollection: async () => [],
  setCollectionItem: async () => {},
  deleteCollectionItem: async () => {},
});

test("archive cascades to the workspace's active sessions", async () => {
  const archivedWorkspaces: string[] = [];
  const archivedSessions: string[] = [];
  const env = createCommandEnvironment(
    {
      extensionStorageService: makeStorageService(),

      workspaceService: {
        setInitializing: async () => null,
        getDefault: async () => ({
          id: "home",
          project_id: "project-1",
          root_path: "/repo",
          execution_kind: "local",
          provider_id: "pstdio.root",
          provider_state: "ready",
        }),
        get: async (id: string) => ({
          id,
          project_id: "project-1",
          workspace_shorthand: "T-1_A1",
          branch: null,
          root_path: null,
          provider_id: "pstdio.worktree",
          provider_ref_json: null,
          execution_kind: "local",
          provider_capabilities_json: {
            files: "write",
            diff: true,
            merge: true,
            rebase: true,
            archive: true,
            delete: true,
          },
          display_path: null,
          archived: false,
        }),
        softDelete: async (id: string) => {
          archivedWorkspaces.push(id);
          return { id, archived: true };
        },
        updateProviderProjection: async (id: string, patch: unknown) => ({
          id,
          archived: true,
          ...(patch as object),
        }),
      },
      workspaceSessionService: {
        listByWorkspace: async () => [
          { id: "session-1", archived: false },
          { id: "session-2", archived: true },
        ],
      },
      sessionService: {
        archive: async (id: string) => {
          archivedSessions.push(id);
        },
      },
    } as never,
    makeEnabledSources() as never,
    {
      extensionId: "pstdio.extension-lab",
      name: "extension-lab",
      project: projectContext,
      projectId: "project-1",
    },
  );

  await env.workspaces.archive("ws-1");

  expect(archivedWorkspaces).toEqual(["ws-1"]);
  expect(archivedSessions).toEqual(["session-1"]);
});

test("fires worktree.removed after extension-initiated deletion", async () => {
  const softDelete = mock(async () => {});
  const remove = mock(async () => true);
  const fireRemoved = mock(() => {});
  const workspace = {
    id: "ws-1",
    project_id: "project-1",
    workspace_shorthand: "T-1_A1",
    anchors_json: [],
    branch: "workspace/T-1_A1",
    root_path: "/repo/.worktrees/T-1_A1",
    provider_id: "pstdio.worktree",
    provider_capabilities_json: { archive: true, delete: true },
    provider_ref_json: null,
    provider_state: "ready",
    execution_kind: "local",
    is_default: false,
  };
  const env = createCommandEnvironment(
    {
      extensionStorageService: makeStorageService(),
      workspaceService: { setInitializing: async () => null, get: async () => workspace, softDelete },
      workspaceSessionService: { listByWorkspace: async () => [] },
    } as never,
    makeEnabledSources() as never,
    {
      extensionId: "pstdio.extension-lab",
      name: "extension-lab",
      project: projectContext,
      projectId: "project-1",
    },
    {
      deleteProviderBackedWorkspace: remove as never,
      fireExtensionEventAsync: fireRemoved as never,
      runWorkspaceProvisioning: async (_deps, input) => input.workspace,
      setupWorkspaceWorktree: async () => ({
        branch: "unused",
        worktreePath: "/unused",
        rootPath: "/unused",
        sourceRoot: "/repo",
        relativePath: "",
      }),
    },
  );

  await env.workspaces.delete("ws-1");

  expect(remove).toHaveBeenCalledTimes(1);
  expect(softDelete).toHaveBeenCalledWith("ws-1");
  expect(fireRemoved).toHaveBeenCalledWith(
    expect.anything(),
    "project-1",
    expect.objectContaining({ id: "worktree.removed" }),
    expect.objectContaining({ workspaceId: "ws-1", worktreePath: workspace.root_path }),
  );
});

test("removes a worktree without deleting its workspace", async () => {
  const softDelete = mock(async () => {});
  const cleanup = mock(async () => true);
  const fireRemoved = mock(() => {});
  const workspace = {
    id: "ws-1",
    project_id: "project-1",
    workspace_shorthand: "T-1_A1",
    anchors_json: [],
    branch: "workspace/T-1_A1",
    root_path: "/repo/.worktrees/T-1_A1",
    provider_id: "pstdio.worktree",
    provider_ref_json: null,
    provider_state: "ready",
    execution_kind: "local",
  };
  const clearWorktree = mock(async () => ({ ...workspace, branch: null, root_path: null }));
  const env = createCommandEnvironment(
    {
      extensionStorageService: makeStorageService(),
      workspaceService: { setInitializing: async () => null, clearWorktree, get: async () => workspace, softDelete },
    } as never,
    makeEnabledSources() as never,
    {
      extensionId: "pstdio.extension-lab",
      name: "extension-lab",
      project: projectContext,
      projectId: "project-1",
    },
    {
      cleanupWorkspaceWorktree: cleanup as never,
      fireExtensionEventAsync: fireRemoved as never,
      runWorkspaceProvisioning: async (_deps, input) => input.workspace,
      setupWorkspaceWorktree: async () => ({
        branch: "unused",
        worktreePath: "/unused",
        rootPath: "/unused",
        sourceRoot: "/repo",
        relativePath: "",
      }),
    },
  );

  await expect(env.workspaces.removeWorktree("ws-1")).resolves.toEqual({ removed: true });
  expect(cleanup).toHaveBeenCalledTimes(1);
  expect(clearWorktree).toHaveBeenCalledWith("ws-1");
  expect(softDelete).not.toHaveBeenCalled();
  expect(fireRemoved).toHaveBeenCalledWith(
    expect.anything(),
    "project-1",
    expect.objectContaining({ id: "worktree.removed" }),
    expect.objectContaining({ workspaceId: "ws-1", worktreePath: workspace.root_path }),
  );
});

test("does not expose or mutate a workspace owned by another project", async () => {
  const cleanup = mock(async () => true);
  const softDelete = mock(async () => {});
  const workspace = {
    id: "other-workspace",
    project_id: "project-2",
    workspace_shorthand: "OTHER_A1",
    anchors_json: [],
    branch: "workspace/OTHER_A1",
    root_path: "/repo/.worktrees/OTHER_A1",
    provider_id: "pstdio.worktree",
    provider_ref_json: null,
    provider_state: "ready",
    execution_kind: "local",
  };
  const env = createCommandEnvironment(
    {
      extensionStorageService: makeStorageService(),
      workspaceService: { setInitializing: async () => null, get: async () => workspace, softDelete },
    } as never,
    makeEnabledSources() as never,
    {
      extensionId: "pstdio.extension-lab",
      name: "extension-lab",
      project: projectContext,
      projectId: "project-1",
    },
    {
      cleanupWorkspaceWorktree: cleanup as never,
      runWorkspaceProvisioning: async (_deps, input) => input.workspace,
      setupWorkspaceWorktree: async () => ({
        branch: "unused",
        worktreePath: "/unused",
        rootPath: "/unused",
        sourceRoot: "/repo",
        relativePath: "",
      }),
    },
  );

  await expect(env.workspaces.get("other-workspace")).resolves.toBeNull();
  await expect(env.workspaces.removeWorktree("other-workspace")).rejects.toThrow(
    "Workspace not found: other-workspace",
  );
  await expect(env.workspaces.delete("other-workspace")).rejects.toThrow("Workspace not found: other-workspace");
  expect(cleanup).not.toHaveBeenCalled();
  expect(softDelete).not.toHaveBeenCalled();
});
