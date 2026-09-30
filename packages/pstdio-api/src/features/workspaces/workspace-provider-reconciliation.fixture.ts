import { mock } from "bun:test";
import type { WorkspaceProviderResult } from "pstdio-api-contracts/extension-kernel";
import { makeWorkspace, remoteWorkspaceCapabilities } from "./workspace-provider.test-fixture";

export const readyRemoteResult = (state: WorkspaceProviderResult["state"]): WorkspaceProviderResult => ({
  providerRef: { version: 1, data: { remoteId: "remote-1" } },
  state,
  executionKind: "remote",
  displayPath: "Pocket Coder remote-1",
  capabilities: remoteWorkspaceCapabilities,
});

export const acceptedRemoteResult = (): WorkspaceProviderResult => ({
  state: "provisioning",
  executionKind: "remote",
  displayPath: "Pocket Coder pending",
  capabilities: remoteWorkspaceCapabilities,
});

export const makeDeps = (provider: Record<string, unknown>, workspace = makeWorkspace()) => {
  provider = { params: { repository: { type: "text" } }, ...provider };
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
        updateProviderOperationProjection: async (
          id: string,
          input: { operationId: string; operationKind: string; patch: Record<string, unknown> },
        ) =>
          stored.provider_operation_id === input.operationId && stored.provider_operation_kind === input.operationKind
            ? updateProviderProjection(id, input.patch)
            : null,
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
