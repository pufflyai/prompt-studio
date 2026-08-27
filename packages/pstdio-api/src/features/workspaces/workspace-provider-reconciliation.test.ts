import { describe, expect, mock, test } from "bun:test";
import type { WorkspaceProviderResult } from "pstdio-api-contracts/extension-kernel";
import { makeWorkspace, remoteWorkspaceCapabilities } from "./workspace-provider.test-fixture";
import { reconcileProviderWorkspaces } from "./workspace-provider-reconciliation";

const readyRemoteResult = (state: WorkspaceProviderResult["state"]): WorkspaceProviderResult => ({
  providerRef: { version: 1, data: { remoteId: "remote-1" } },
  state,
  executionKind: "remote",
  displayPath: "Pocket Coder remote-1",
  capabilities: remoteWorkspaceCapabilities,
});

const acceptedRemoteResult = (): WorkspaceProviderResult => ({
  state: "provisioning",
  executionKind: "remote",
  displayPath: "Pocket Coder pending",
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

describe("reconcileProviderWorkspaces", () => {
  test("resolves a ready remote workspace after restart", async () => {
    const resolve = mock(async () => readyRemoteResult("ready"));
    const workspace = makeWorkspace({
      execution_kind: "remote",
      provider_state: "ready",
    });
    const { deps, updateProviderProjection } = makeDeps({ resolve }, workspace);

    await reconcileProviderWorkspaces(deps, "project-1");

    expect(resolve).toHaveBeenCalledTimes(1);
    expect(updateProviderProjection).toHaveBeenCalledWith(
      workspace.id,
      expect.objectContaining({ provider_state: "ready" }),
    );
  });

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

  test("keeps reconciling an accepted create before startup session recovery", async () => {
    const create = mock(async () => ({
      ...acceptedRemoteResult(),
      providerRef: { version: 1, data: { remoteId: "remote-1" } },
    }));
    const resolve = mock(async () => readyRemoteResult("ready"));
    const workspace = makeWorkspace({
      provider_ref_json: null,
      provider_state: "provisioning",
      provider_operation_id: "op-restart-create",
      provider_operation_kind: "create",
    });
    const { deps, updateProviderProjection } = makeDeps({ create, resolve }, workspace);

    await reconcileProviderWorkspaces(deps, "project-1", { retryUntilReadyMs: 50, retryDelayMs: 1 });

    expect(create).toHaveBeenCalledTimes(1);
    expect(resolve).toHaveBeenCalledTimes(1);
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
});

describe("reconcileProviderWorkspaces lifecycle operations", () => {
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

  test("keeps replaying the accepted create id while cancellation still has no provider reference", async () => {
    const seen: string[] = [];
    const create = mock(async (_ctx: unknown, input: { operationId: string }) => {
      seen.push(input.operationId);
      return acceptedRemoteResult();
    });
    const workspace = makeWorkspace({
      provider_ref_json: null,
      provider_state: "provisioning",
      provider_operation_id: "op-create-before-cancel",
      provider_operation_kind: "cancel",
    });
    const { deps, updateProviderProjection } = makeDeps(
      { create, cancel: async () => readyRemoteResult("cancelled") },
      workspace,
    );

    await reconcileProviderWorkspaces(deps, "project-1");
    await reconcileProviderWorkspaces(deps, "project-1");

    expect(seen).toEqual(["op-create-before-cancel", "op-create-before-cancel"]);
    expect(updateProviderProjection.mock.calls.at(-1)?.[1]).toMatchObject({
      provider_operation_id: "op-create-before-cancel",
      provider_operation_kind: "cancel",
    });
  });

  test("recovers the accepted create before running its deferred delete", async () => {
    const create = mock(async (_ctx: unknown, input: { operationId: string }) => {
      expect(input.operationId).toBe("op-create-before-delete");
      return readyRemoteResult("ready");
    });
    const seenDeleteIds: string[] = [];
    const del = mock(async (_ctx: unknown, input: { operationId: string }) => {
      seenDeleteIds.push(input.operationId);
    });
    const workspace = makeWorkspace({
      provider_ref_json: null,
      provider_state: "deleting",
      provider_operation_id: "op-create-before-delete",
      provider_operation_kind: "delete",
    });
    const { deps, softDelete } = makeDeps({ create, delete: del }, workspace);

    await reconcileProviderWorkspaces(deps, "project-1");

    expect(create).toHaveBeenCalledTimes(1);
    expect(seenDeleteIds).toHaveLength(1);
    expect(seenDeleteIds[0]).not.toBe("op-create-before-delete");
    expect(softDelete).toHaveBeenCalledWith("ws-1");
  });

  test("recovers the accepted create before running its deferred archive", async () => {
    const create = mock(async () => readyRemoteResult("ready"));
    const archive = mock(async () => readyRemoteResult("archived"));
    const workspace = makeWorkspace({
      provider_ref_json: null,
      provider_state: "archiving",
      provider_operation_id: "op-create-before-archive",
      provider_operation_kind: "archive",
    });
    const { deps } = makeDeps({ create, archive }, workspace);

    await reconcileProviderWorkspaces(deps, "project-1");

    expect(create).toHaveBeenCalledTimes(1);
    expect(archive).toHaveBeenCalledTimes(1);
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
