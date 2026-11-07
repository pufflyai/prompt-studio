import type { JsonObject } from "pstdio-api-contracts/extension-kernel";
import type { WorkspacesRouteDeps } from "./deps";
import { requireWorkspaceProviderParams } from "./workspace-provider-discovery";
import { validateWorkspaceParams } from "./workspace-provider-params";
import type { WorkspaceRecord } from "./workspace-provider-projection";
import type { WorkspaceProviderHandle } from "./workspace-provider-runtime";

export const persistRetryParams = async (
  deps: WorkspacesRouteDeps,
  workspace: WorkspaceRecord,
  handle: WorkspaceProviderHandle,
) => {
  const params = validateWorkspaceParams(
    workspace.provider_id,
    await requireWorkspaceProviderParams(handle, workspace.provider_id),
    workspace.provider_params_json as JsonObject,
  );
  return deps.workspaceService.updateProviderOperationProjection(workspace.id, {
    operationId: workspace.provider_operation_id!,
    operationKind: workspace.provider_operation_kind!,
    patch: { provider_params_json: params },
  });
};
