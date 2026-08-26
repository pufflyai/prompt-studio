import { describe, expect, mock, test } from "bun:test";
import type { WorkspaceProviderResult } from "pstdio-api-contracts/extension-kernel";
import {
  archiveProviderBackedWorkspace,
  cancelProviderBackedWorkspace,
  deleteProviderBackedWorkspace,
  reconcileProviderWorkspaces,
} from "./workspace-provider-lifecycle";

const remoteCapabilities = {
  files: "none" as const,
  diff: false,
  merge: false,
  rebase: false,
  archive: true,
  delete: true,
};

const makeRemoteWorkspace = (patch: Record<string, unknown> = {}) => ({
  id: "ws-1",
  project_id: "project-1",
  name: "WS-1",
  branch: null,
  worktree_path: null,
  provider_id: "pocketcoder.remote",
  provider_params_json: { repository: "repo" },
  provider_ref_json: { version: 1, data: { remoteId: "remote-1" } },
  provider_state: "ready" as const,
  execution_kind: "remote" as const,
  provider_operation_id: null,
  provider_operation_kind: null,
  provider_error_json: null,
  provider_capabilities_json: remoteCapabilities,
  display_path: "Pocket Coder remote-1",
  is_default: false,
  archived: false,
  workspace_shorthand: "WS-1",
  initializing: false,
  setup_error: null,
  startup_log_file_id: null,
  anchors_json: [],
  created_at: "2026-08-26T00:00:00.000Z",
  updated_at: "2026-08-26T00:00:00.000Z",
  deleted_at: null,
  ...patch,
});

const readyRemoteResult = (state: WorkspaceProviderResult["state"]): WorkspaceProviderResult => ({
  providerRef: { version: 1, data: { remoteId: "remote-1" } },
  state,
  executionKind: "remote",
  displayPath: "Pocket Coder remote-1",
  capabilities: remoteCapabilities,
});

const makeDeps = (provider: Record<string, unknown>, workspace = makeRemoteWorkspace()) => {
  const updateProviderProjection = mock(async (_id: string, patch: Record<string, unknown>) => ({
    ...workspace,
    ...patch,
  }));
  const listByProject = mock(async () => [{ id: "repo-1", path: "/repo" }]);
  const softDelete = mock(async () => {});
  return {
    deps: {
      workspaceService: {
        get: async () => workspace,
        list: async () => [workspace],
        updateProviderProjection,
        softDelete,
      },
      repoService: { listByProject },
      extensionRuntimeCatalog: {
        get: async () => ({ runtime: { workspaceTypes: [{ id: "pocketcoder.remote", provider }] } }),
      },
    } as never,
    updateProviderProjection,
    listByProject,
    softDelete,
  };
};

describe("archiveProviderBackedWorkspace", () => {
  test("calls provider archive with a persisted operation id and skips worktree cleanup", async () => {
    const archive = mock(async (_ctx: unknown, input: { operationId: string }) => {
      expect(input.operationId).toBeTruthy();
      return readyRemoteResult("archived");
    });
    const { deps, updateProviderProjection, listByProject } = makeDeps({ archive });

    const updated = await archiveProviderBackedWorkspace(deps, makeRemoteWorkspace() as never);

    expect(archive).toHaveBeenCalledTimes(1);
    expect(listByProject).not.toHaveBeenCalled();
    expect(updated?.provider_state).toBe("archived");
    // First projection persists the operation before the provider call.
    expect(updateProviderProjection.mock.calls[0]?.[1]).toMatchObject({
      provider_state: "archiving",
      provider_operation_kind: "archive",
    });
  });

  test("keeps worktree cleanup for the built-in provider", async () => {
    const workspace = makeRemoteWorkspace({
      provider_id: "pstdio.worktree",
      execution_kind: "local",
      worktree_path: "/tmp/ws",
      provider_ref_json: null,
    });
    const { deps, listByProject, updateProviderProjection } = makeDeps({}, workspace);

    const updated = await archiveProviderBackedWorkspace(deps, workspace as never);

    expect(listByProject).toHaveBeenCalled();
    expect(updated?.provider_state).toBe("archived");
    expect(updateProviderProjection.mock.calls[0]?.[1]).toMatchObject({ provider_state: "archived" });
  });

  test("marks the workspace blocked when the provider is missing and preserves the reference", async () => {
    const workspace = makeRemoteWorkspace();
    const updateProviderProjection = mock(async (_id: string, patch: Record<string, unknown>) => ({
      ...workspace,
      ...patch,
    }));
    const deps = {
      workspaceService: { updateProviderProjection },
      repoService: { listByProject: mock(async () => []) },
      extensionRuntimeCatalog: { get: async () => ({ runtime: { workspaceTypes: [] } }) },
    } as never;

    const updated = await archiveProviderBackedWorkspace(deps, workspace as never);

    expect(updated?.provider_state).toBe("provider_missing");
    expect(updateProviderProjection.mock.calls[0]?.[1]).toMatchObject({
      provider_ref_json: workspace.provider_ref_json,
    });
  });
});

describe("deleteProviderBackedWorkspace", () => {
  test("reuses a stored delete operation id so retries stay idempotent", async () => {
    const seen: string[] = [];
    const del = mock(async (_ctx: unknown, input: { operationId: string }) => {
      seen.push(input.operationId);
    });
    const workspace = makeRemoteWorkspace({ provider_operation_id: "op-9", provider_operation_kind: "delete" });
    const { deps } = makeDeps({ delete: del }, workspace);

    await deleteProviderBackedWorkspace(deps, workspace as never);

    expect(seen).toEqual(["op-9"]);
  });
});

describe("cancelProviderBackedWorkspace", () => {
  test("calls provider cancel and stores the returned state", async () => {
    const cancel = mock(async () => readyRemoteResult("cancelled"));
    const workspace = makeRemoteWorkspace({ provider_state: "provisioning" });
    const { deps } = makeDeps({ cancel }, workspace);

    const updated = await cancelProviderBackedWorkspace(deps, workspace as never);

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(updated?.provider_state).toBe("cancelled");
  });
});

describe("reconcileProviderWorkspaces", () => {
  test("retries an interrupted create with the stored operation id", async () => {
    const seen: string[] = [];
    const create = mock(async (_ctx: unknown, input: { operationId: string; params: Record<string, unknown> }) => {
      seen.push(input.operationId);
      expect(input.params).toEqual({ repository: "repo" });
      return readyRemoteResult("ready");
    });
    const workspace = makeRemoteWorkspace({
      provider_ref_json: null,
      provider_state: "provisioning",
      provider_operation_id: "op-create-1",
      provider_operation_kind: "create",
    });
    const { deps, updateProviderProjection } = makeDeps({ create }, workspace);

    await reconcileProviderWorkspaces(deps, "project-1");

    expect(seen).toEqual(["op-create-1"]);
    expect(updateProviderProjection.mock.calls.at(-1)?.[1]).toMatchObject({ provider_state: "ready" });
  });

  test("resolves a provisioning workspace with its stored reference", async () => {
    const resolve = mock(async (_ctx: unknown, input: { providerRef: { version: number } }) => {
      expect(input.providerRef.version).toBe(1);
      return readyRemoteResult("ready");
    });
    const workspace = makeRemoteWorkspace({ provider_state: "provisioning" });
    const { deps, updateProviderProjection } = makeDeps({ resolve }, workspace);

    await reconcileProviderWorkspaces(deps, "project-1");

    expect(resolve).toHaveBeenCalledTimes(1);
    expect(updateProviderProjection.mock.calls.at(-1)?.[1]).toMatchObject({ provider_state: "ready" });
  });

  test("does not touch built-in or settled workspaces", async () => {
    const workspace = makeRemoteWorkspace({ provider_id: "pstdio.worktree", provider_state: "ready" });
    const { deps, updateProviderProjection } = makeDeps({}, workspace);

    await reconcileProviderWorkspaces(deps, "project-1");

    expect(updateProviderProjection).not.toHaveBeenCalled();
  });
});
