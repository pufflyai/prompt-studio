import { describe, expect, mock, test } from "bun:test";
import type { WorkspaceProviderResult } from "pstdio-api-contracts/extension-kernel";
import { makeWorkspace, remoteWorkspaceCapabilities } from "./workspace-provider.test-fixture";
import {
  archiveProviderBackedWorkspace,
  cancelProviderBackedWorkspace,
  deleteProviderBackedWorkspace,
} from "./workspace-provider-lifecycle";
import { reconcileProviderWorkspaces } from "./workspace-provider-reconciliation";

const readyRemoteResult = (state: WorkspaceProviderResult["state"]): WorkspaceProviderResult => ({
  providerRef: { version: 1, data: { remoteId: "remote-1" } },
  state,
  executionKind: "remote",
  displayPath: "Pocket Coder remote-1",
  capabilities: remoteWorkspaceCapabilities,
});

const makeDeps = (provider: Record<string, unknown>, workspace = makeWorkspace()) => {
  let stored = workspace;
  const updateProviderProjection = mock(async (_id: string, patch: Record<string, unknown>) => {
    stored = { ...stored, ...patch };
    return stored;
  });
  const listByProject = mock(async () => [{ id: "repo-1", path: "/repo" }]);
  const softDelete = mock(async () => {});
  return {
    deps: {
      workspaceService: {
        get: async () => stored,
        listForProviderReconciliation: async () => [stored],
        updateProviderProjection,
        softDelete,
        archive: async () => {
          stored = { ...stored, archived: true };
          return stored;
        },
      },
      repoService: { listByProject },
      workspaceSessionService: { listByWorkspace: async () => [] },
      sessionService: { archive: async () => {} },
      workspaceProviderRuntime: {
        find: async () => ({ context: {} as never, provider: provider as never }),
      },
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

    const updated = await archiveProviderBackedWorkspace(deps, makeWorkspace() as never);

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
    const workspace = makeWorkspace({
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
    const workspace = makeWorkspace();
    const updateProviderProjection = mock(async (_id: string, patch: Record<string, unknown>) => ({
      ...workspace,
      ...patch,
    }));
    const deps = {
      workspaceService: { updateProviderProjection },
      repoService: { listByProject: mock(async () => []) },
      workspaceProviderRuntime: { find: async () => undefined },
      extensionRuntimeCatalog: { get: async () => ({ runtime: { workspaceTypes: [] } }) },
    } as never;

    const updated = await archiveProviderBackedWorkspace(deps, workspace as never);

    expect(updated?.provider_state).toBe("provider_missing");
    expect(updateProviderProjection.mock.calls.at(-1)?.[1]).toMatchObject({
      provider_ref_json: workspace.provider_ref_json,
      provider_operation_kind: "archive",
    });
  });
});

describe("deleteProviderBackedWorkspace", () => {
  test("reuses a stored delete operation id so retries stay idempotent", async () => {
    const seen: string[] = [];
    const del = mock(async (_ctx: unknown, input: { operationId: string }) => {
      seen.push(input.operationId);
    });
    const workspace = makeWorkspace({ provider_operation_id: "op-9", provider_operation_kind: "delete" });
    const { deps } = makeDeps({ delete: del }, workspace);

    await deleteProviderBackedWorkspace(deps, workspace as never);

    expect(seen).toEqual(["op-9"]);
  });
});

describe("cancelProviderBackedWorkspace", () => {
  test("calls provider cancel and stores the returned state", async () => {
    const cancel = mock(async () => readyRemoteResult("cancelled"));
    const workspace = makeWorkspace({ provider_state: "provisioning" });
    const { deps } = makeDeps({ cancel }, workspace);

    const updated = await cancelProviderBackedWorkspace(deps, workspace as never);

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(updated?.provider_state).toBe("cancelled");
  });

  test("does not cancel a ready workspace", async () => {
    const cancel = mock(async () => readyRemoteResult("cancelled"));
    const workspace = makeWorkspace({ provider_state: "ready" });
    const { deps, updateProviderProjection } = makeDeps({ cancel }, workspace);

    const updated = await cancelProviderBackedWorkspace(deps, workspace as never);

    expect(cancel).not.toHaveBeenCalled();
    expect(updateProviderProjection).not.toHaveBeenCalled();
    expect(updated.provider_state).toBe("ready");
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
    const workspace = makeWorkspace({
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
    const workspace = makeWorkspace({ provider_state: "provisioning" });
    const { deps, updateProviderProjection } = makeDeps({ resolve }, workspace);

    await reconcileProviderWorkspaces(deps, "project-1");

    expect(resolve).toHaveBeenCalledTimes(1);
    expect(updateProviderProjection.mock.calls.at(-1)?.[1]).toMatchObject({ provider_state: "ready" });
  });

  test("preserves the stored reference when resolve omits it", async () => {
    const resolve = mock(async () => {
      const result = readyRemoteResult("ready");
      return { ...result, providerRef: undefined };
    });
    const workspace = makeWorkspace({ provider_state: "provisioning" });
    const { deps, updateProviderProjection } = makeDeps({ resolve }, workspace);

    await reconcileProviderWorkspaces(deps, "project-1");

    expect(updateProviderProjection.mock.calls.at(-1)?.[1]).toMatchObject({
      provider_ref_json: workspace.provider_ref_json,
    });
  });

  test("does not touch built-in or settled workspaces", async () => {
    const workspace = makeWorkspace({ provider_id: "pstdio.worktree", provider_state: "ready" });
    const { deps, updateProviderProjection } = makeDeps({}, workspace);

    await reconcileProviderWorkspaces(deps, "project-1");

    expect(updateProviderProjection).not.toHaveBeenCalled();
  });

  test("retries a failed create when the provider becomes available", async () => {
    const create = mock(async () => readyRemoteResult("ready"));
    const workspace = makeWorkspace({
      provider_ref_json: null,
      provider_state: "failed",
      provider_operation_id: "op-create-failed",
      provider_operation_kind: "create",
      provider_error_json: {
        code: "provider_create_failed",
        message: "temporary failure",
        retryable: true,
        occurred_at: "2026-08-26T00:00:00.000Z",
      },
    });
    const { deps, updateProviderProjection } = makeDeps({ create }, workspace);

    await reconcileProviderWorkspaces(deps, "project-1");

    expect(create).toHaveBeenCalledTimes(1);
    expect(updateProviderProjection.mock.calls.at(-1)?.[1]).toMatchObject({ provider_state: "ready" });
  });

  test("retries create after a missing provider becomes available", async () => {
    const create = mock(async () => readyRemoteResult("ready"));
    const workspace = makeWorkspace({
      provider_ref_json: null,
      provider_state: "provider_missing",
      provider_operation_id: "op-create-missing",
      provider_operation_kind: "create",
      provider_error_json: {
        code: "provider_unavailable",
        message: "provider not loaded",
        retryable: true,
        occurred_at: "2026-08-26T00:00:00.000Z",
      },
    });
    const { deps, updateProviderProjection } = makeDeps({ create }, workspace);

    await reconcileProviderWorkspaces(deps, "project-1");

    expect(create).toHaveBeenCalledTimes(1);
    expect(updateProviderProjection.mock.calls.at(-1)?.[1]).toMatchObject({ provider_state: "ready" });
  });

  test("reissues an interrupted delete and soft-deletes the row", async () => {
    const del = mock(async () => {});
    const workspace = makeWorkspace({
      provider_state: "deleting",
      provider_operation_id: "op-delete-1",
      provider_operation_kind: "delete",
    });
    const { deps, softDelete } = makeDeps({ delete: del }, workspace);

    await reconcileProviderWorkspaces(deps, "project-1");

    expect(del).toHaveBeenCalledTimes(1);
    expect(softDelete).toHaveBeenCalledWith("ws-1");
  });

  test("reissues an interrupted cancel instead of resolving over it", async () => {
    const cancel = mock(async () => readyRemoteResult("cancelled"));
    const resolve = mock(async () => readyRemoteResult("ready"));
    const workspace = makeWorkspace({
      provider_state: "provisioning",
      provider_operation_id: "op-cancel-1",
      provider_operation_kind: "cancel",
    });
    const { deps, updateProviderProjection } = makeDeps({ cancel, resolve }, workspace);

    await reconcileProviderWorkspaces(deps, "project-1");

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(resolve).not.toHaveBeenCalled();
    expect(updateProviderProjection.mock.calls.at(-1)?.[1]).toMatchObject({ provider_state: "cancelled" });
  });

  test("settles an interrupted archive when the provider has no archive method", async () => {
    const workspace = makeWorkspace({
      provider_state: "archiving",
      provider_operation_id: "op-archive-1",
      provider_operation_kind: "archive",
    });
    const { deps, updateProviderProjection } = makeDeps({}, workspace);

    await reconcileProviderWorkspaces(deps, "project-1");

    expect(updateProviderProjection.mock.calls.at(-1)?.[1]).toMatchObject({
      provider_state: "archived",
      provider_operation_id: null,
      provider_operation_kind: null,
    });
  });

  test("records a retryable failure when a provider call times out", async () => {
    const resolve = mock(() => new Promise<WorkspaceProviderResult>(() => {}));
    const workspace = makeWorkspace({ provider_state: "provisioning" });
    const { deps, updateProviderProjection } = makeDeps({ resolve }, workspace);

    await reconcileProviderWorkspaces(deps, "project-1", { providerTimeoutMs: 1 });

    expect(updateProviderProjection.mock.calls.at(-1)?.[1]).toMatchObject({
      provider_state: "failed",
      provider_operation_kind: "create",
      provider_error_json: { retryable: true },
    });
  });
});

describe("deleteProviderBackedWorkspace without an installed provider", () => {
  test("allows the caller to remove the workspace row", async () => {
    const workspace = makeWorkspace();
    const updateProviderProjection = mock(async () => workspace);
    const deps = {
      workspaceService: { updateProviderProjection },
      repoService: { listByProject: mock(async () => []) },
      workspaceProviderRuntime: { find: async () => undefined },
      extensionRuntimeCatalog: { get: async () => ({ runtime: { workspaceTypes: [] } }) },
    } as never;

    await expect(deleteProviderBackedWorkspace(deps, workspace as never)).resolves.toBe(false);
    expect(updateProviderProjection).not.toHaveBeenCalled();
  });
});
