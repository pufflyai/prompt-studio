import type { WorkspacesRouteDeps } from "./deps";
import { isBuiltInProviderId, remoteReadOnlyCapabilities } from "./workspace-provider-identity";
import { updateCreateProjection } from "./workspace-provider-operation-projection";
import { InvalidWorkspaceParamsError } from "./workspace-provider-params";
import {
  failedOperationPatch,
  pendingCreateCancellationPatch,
  providerError,
  type WorkspaceRecord,
} from "./workspace-provider-projection";
export const failWorkspaceCreation = async (
  deps: WorkspacesRouteDeps,
  input: { workspace: WorkspaceRecord; providerId: string; operationId: string; signal?: AbortSignal },
  error: unknown,
) => {
  if (error instanceof InvalidWorkspaceParamsError) {
    return (
      await updateCreateProjection(deps, input.workspace, input.operationId, {
        provider_state: "failed",
        provider_operation_id: null,
        provider_operation_kind: null,
        provider_error_json: providerError({
          code: "invalid_provider_params",
          message: error.message,
          retryable: false,
        }),
      })
    ).workspace;
  }
  if (input.signal?.aborted) {
    const patch = pendingCreateCancellationPatch(input.workspace, input.operationId, error);
    return (await updateCreateProjection(deps, input.workspace, input.operationId, patch)).workspace;
  }
  return (
    await updateCreateProjection(deps, input.workspace, input.operationId, {
      ...failedOperationPatch(input.workspace, {
        kind: "create",
        operationId: input.operationId,
        state: "failed",
        error,
      }),
      ...(isBuiltInProviderId(input.providerId)
        ? {
            provider_error_json: providerError({
              code: "provider_create_failed",
              message: error instanceof Error ? error.message : String(error),
              retryable: true,
            }),
          }
        : {}),
      execution_kind: isBuiltInProviderId(input.providerId) ? "local" : "remote",
      provider_capabilities_json: remoteReadOnlyCapabilities,
    })
  ).workspace;
};
