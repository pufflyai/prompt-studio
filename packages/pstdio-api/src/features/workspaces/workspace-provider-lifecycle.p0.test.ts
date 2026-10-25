import { describe, expect, mock, test } from "bun:test";
import type { WorkspaceProviderResult } from "pstdio-api-contracts/extension-kernel";
import { makeWorkspace, remoteWorkspaceCapabilities } from "./workspace-provider.test-fixture";
import { cancelProviderBackedWorkspace, deleteProviderBackedWorkspace } from "./workspace-provider-lifecycle";

const readyRemoteResult = (state: WorkspaceProviderResult["state"]): WorkspaceProviderResult => ({
  providerRef: { version: 1, data: { remoteId: "remote-1" } },
  state,
  executionKind: "remote",
  displayPath: "Pocket Coder remote-1",
  capabilities: remoteWorkspaceCapabilities,
});

type SessionRow = { id: string; status: string; archived: boolean };

const makeDeps = (provider: Record<string, unknown>, workspace = makeWorkspace(), sessions: SessionRow[] = []) => {
  let stored = workspace;
  const events: string[] = [];
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
      workspaceSessionService: { listByWorkspace: async () => sessions },
      sessionService: {
        archive: async (id: string) => events.push(`archive ${id}`),
        cancel: async (id: string) => events.push(`cancel ${id}`),
      },
      workspaceProviderRuntime: {
        find: async () => ({ context: {} as never, provider: provider as never }),
      },
      extensionRuntimeCatalog: {
        get: async () => ({ runtime: { workspaceTypes: [{ id: "pocketcoder.remote", provider }] } }),
      },
    } as never,
    updateProviderProjection,
    beginProviderOperation,
    softDelete,
    events,
  };
};

const workspaceSessions: SessionRow[] = [
  { id: "running", status: "in_progress", archived: false },
  { id: "waiting", status: "awaiting_input", archived: false },
  { id: "queued", status: "queued", archived: false },
  { id: "done", status: "completed", archived: false },
];

describe("workspace removal stops its agents first", () => {
  test("delete cancels active sessions before the provider removes the workspace", async () => {
    const { deps, events } = makeDeps(
      { delete: async () => events.push("provider delete") },
      makeWorkspace(),
      workspaceSessions,
    );

    await deleteProviderBackedWorkspace(deps, makeWorkspace() as never);

    expect(events).toEqual(["cancel running", "cancel waiting", "cancel queued", "provider delete"]);
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
      workspaceSessionService: { listByWorkspace: async () => [] },
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
