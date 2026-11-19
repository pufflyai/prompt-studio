import type { WorkspacesRouteDeps } from "./deps";
import { isBuiltInProviderId } from "./workspace-provider-identity";
import { missingProviderPatch, type WorkspaceRecord } from "./workspace-provider-projection";
import { findWorkspaceProvider } from "./workspace-provider-runtime";

type ProviderProjectionPatch = Parameters<
  WorkspacesRouteDeps["workspaceService"]["updateProviderOperationProjection"]
>[1]["patch"];

export const updateCreateProjection = async (
  deps: WorkspacesRouteDeps,
  workspace: WorkspaceRecord,
  operationId: string,
  patch: ProviderProjectionPatch,
) => {
  let observed = workspace;
  while (
    !observed.deleted_at &&
    observed.provider_operation_id === operationId &&
    observed.provider_operation_kind === "create"
  ) {
    const missing =
      !isBuiltInProviderId(observed.provider_id) &&
      !(await findWorkspaceProvider(deps, {
        projectId: observed.project_id,
        providerId: observed.provider_id,
        workspaceId: observed.id,
      }));
    const next = missing
      ? {
          ...patch,
          ...missingProviderPatch({
            ...observed,
            ...patch,
            provider_operation_id: operationId,
            provider_operation_kind: "create",
          }),
        }
      : patch;
    const updated = await deps.workspaceService.updateProviderOperationProjection(observed.id, {
      operationId,
      operationKind: "create",
      expectedState: observed.provider_state,
      patch: next,
    });
    if (updated) return { applied: true, workspace: updated };
    const current = await deps.workspaceService.get(observed.id);
    if (!current) return { applied: false, workspace: observed };
    // Only a state race within this accepted create may be re-admitted. Cancellation/deletion owns its successor.
    observed = current;
  }
  return { applied: false, workspace: observed };
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
