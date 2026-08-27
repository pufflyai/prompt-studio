import { describe, expect, mock, test } from "bun:test";
import type { WorkspaceProviderResult } from "pstdio-api-contracts/extension-kernel";
import { makeWorkspace, remoteWorkspaceCapabilities } from "./workspace-provider.test-fixture";
import {
  archiveProviderBackedWorkspace,
  cancelProviderBackedWorkspace,
  deleteProviderBackedWorkspace,
} from "./workspace-provider-lifecycle";

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
  const beginProviderOperation = mock(
    async (_id: string, input: { operationId: string; kind: string; state: string }) => {
      const operationId = stored.provider_operation_id ?? input.operationId;
      stored = {
        ...stored,
        provider_state: input.state,
        provider_operation_id: operationId,
        provider_operation_kind: input.kind,
        provider_error_json: null,
      } as unknown as typeof stored;
      return stored;
    },
  );
  const listByProject = mock(async () => [{ id: "repo-1", path: "/repo" }]);
  const softDelete = mock(async () => {});
  return {
    deps: {
      workspaceService: {
        get: async () => stored,
        listForProviderReconciliation: async () => [stored],
        updateProviderProjection,
        beginProviderOperation,
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
    beginProviderOperation,
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
    const { deps, beginProviderOperation, listByProject } = makeDeps({ archive });

    const updated = await archiveProviderBackedWorkspace(deps, makeWorkspace() as never);

    expect(archive).toHaveBeenCalledTimes(1);
    expect(listByProject).not.toHaveBeenCalled();
    expect(updated?.provider_state).toBe("archived");
    expect(beginProviderOperation).toHaveBeenCalledWith("ws-1", {
      operationId: expect.any(String),
      kind: "archive",
      state: "archiving",
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
      workspaceService: {
        updateProviderProjection,
        beginProviderOperation: async (_id: string, input: { operationId: string; kind: string; state: string }) => ({
          ...workspace,
          provider_state: input.state,
          provider_operation_id: input.operationId,
          provider_operation_kind: input.kind,
        }),
      },
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

  test("keeps an accepted create id pending until archive can recover its provider reference", async () => {
    const workspace = makeWorkspace({
      provider_ref_json: null,
      provider_state: "provisioning",
      provider_operation_id: "op-create-before-archive",
      provider_operation_kind: "create",
    });
    const archive = mock(async () => readyRemoteResult("archived"));
    const { deps } = makeDeps({ archive }, workspace);

    const updated = await archiveProviderBackedWorkspace(deps, workspace as never);

    expect(archive).not.toHaveBeenCalled();
    expect(updated).toMatchObject({
      provider_state: "archiving",
      provider_operation_id: "op-create-before-archive",
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

  test("shares one operation id across concurrent delete requests", async () => {
    const seen: string[] = [];
    const del = mock(async (_ctx: unknown, input: { operationId: string }) => {
      seen.push(input.operationId);
    });
    const workspace = makeWorkspace();
    const { deps } = makeDeps({ delete: del }, workspace);

    await Promise.all([
      deleteProviderBackedWorkspace(deps, workspace as never),
      deleteProviderBackedWorkspace(deps, workspace as never),
    ]);

    expect(seen).toHaveLength(2);
    expect(new Set(seen).size).toBe(1);
  });

  test("preserves an accepted create id until deletion can recover its provider reference", async () => {
    const workspace = makeWorkspace({
      provider_ref_json: null,
      provider_state: "provisioning",
      provider_operation_id: "op-create-before-delete",
      provider_operation_kind: "create",
    });
    const { deps, updateProviderProjection } = makeDeps({ delete: async () => {} }, workspace);

    await expect(deleteProviderBackedWorkspace(deps, workspace as never)).rejects.toThrow(/reference/i);

    expect(updateProviderProjection.mock.calls.at(-1)?.[1]).toMatchObject({
      provider_state: "deleting",
      provider_operation_id: "op-create-before-delete",
      provider_operation_kind: "delete",
    });
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

  test("preserves the accepted create operation until its provider reference can be recovered", async () => {
    const cancel = mock(async () => readyRemoteResult("cancelled"));
    const workspace = makeWorkspace({
      provider_ref_json: null,
      provider_state: "provisioning",
      provider_operation_id: "op-create-accepted",
      provider_operation_kind: "create",
    });
    const { deps, updateProviderProjection } = makeDeps({ cancel }, workspace);

    const updated = await cancelProviderBackedWorkspace(deps, workspace as never);

    expect(cancel).not.toHaveBeenCalled();
    expect(updated).toMatchObject({
      provider_state: "provisioning",
      provider_operation_id: "op-create-accepted",
      provider_operation_kind: "cancel",
    });
    expect(updateProviderProjection.mock.calls.at(-1)?.[1]).toMatchObject({
      provider_operation_id: "op-create-accepted",
      provider_operation_kind: "cancel",
    });
  });
});

describe("deleteProviderBackedWorkspace without an installed provider", () => {
  test("keeps the remote workspace recoverable", async () => {
    const workspace = makeWorkspace();
    const updateProviderProjection = mock(async () => workspace);
    const deps = {
      workspaceService: {
        updateProviderProjection,
        beginProviderOperation: async (_id: string, input: { operationId: string; kind: string; state: string }) => ({
          ...workspace,
          provider_state: input.state,
          provider_operation_id: input.operationId,
          provider_operation_kind: input.kind,
        }),
      },
      repoService: { listByProject: mock(async () => []) },
      workspaceProviderRuntime: { find: async () => undefined },
      extensionRuntimeCatalog: { get: async () => ({ runtime: { workspaceTypes: [] } }) },
    } as never;

    await expect(deleteProviderBackedWorkspace(deps, workspace as never)).rejects.toThrow(/not available/);
    expect(updateProviderProjection).toHaveBeenCalledWith(
      workspace.id,
      expect.objectContaining({
        provider_state: "provider_missing",
        provider_error_json: expect.objectContaining({ retryable: true }),
      }),
    );
  });
});
