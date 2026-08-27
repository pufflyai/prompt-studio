import type { WorkspacesRouteDeps } from "./deps";
import type { WorkspaceRecord } from "./workspace-provider-projection";

type ProviderProjectionPatch = Parameters<
  WorkspacesRouteDeps["workspaceService"]["updateProviderOperationProjection"]
>[1]["patch"];

export const updateCreateProjection = async (
  deps: WorkspacesRouteDeps,
  workspace: WorkspaceRecord,
  operationId: string,
  patch: ProviderProjectionPatch,
) => {
  const updated = await deps.workspaceService.updateProviderOperationProjection(workspace.id, {
    operationId,
    operationKind: "create",
    patch,
  });
  if (updated) return { applied: true, workspace: updated };
  return {
    applied: false,
    workspace: (await deps.workspaceService.get(workspace.id)) ?? workspace,
  };
};

export const handOffLateCreateProjection = async (
  deps: WorkspacesRouteDeps,
  workspace: WorkspaceRecord,
  patch: ProviderProjectionPatch,
) => {
  const operationId = workspace.provider_operation_id;
  const operationKind = workspace.provider_operation_kind;
  if (!operationId || !operationKind || operationKind === "create") return workspace;

  const updated = await deps.workspaceService.updateProviderOperationProjection(workspace.id, {
    operationId,
    operationKind,
    patch: {
      ...patch,
      provider_state: workspace.provider_state,
      provider_operation_id: operationId,
      provider_operation_kind: operationKind,
    },
  });
  if (updated) return updated;
  return (await deps.workspaceService.get(workspace.id)) ?? workspace;
};
