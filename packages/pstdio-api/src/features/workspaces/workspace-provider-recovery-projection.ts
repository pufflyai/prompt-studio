import type { WorkspacesRouteDeps } from "./deps";
import { removeInactiveWorkspaceProviderDirectory } from "./workspace-provider-directory";
import {
  failedOperationPatch,
  type WorkspaceProviderOperationKind,
  type WorkspaceRecord,
} from "./workspace-provider-projection";

export const pendingStateFor = (kind: WorkspaceProviderOperationKind) => {
  if (kind === "archive") return "archiving" as const;
  if (kind === "delete") return "deleting" as const;
  if (kind === "create") return "failed" as const;
  return "provisioning" as const;
};

export const updateReconciledProjection = (
  deps: WorkspacesRouteDeps,
  workspace: WorkspaceRecord,
  patch: Parameters<WorkspacesRouteDeps["workspaceService"]["updateProviderProjection"]>[1],
) =>
  deps.workspaceService.updateProviderOperationProjection(workspace.id, {
    operationId: workspace.provider_operation_id,
    operationKind: workspace.provider_operation_kind,
    expectedState: workspace.provider_state,
    patch,
  });

export const recordProviderRecoveryFailure = async (
  deps: WorkspacesRouteDeps,
  workspace: WorkspaceRecord,
  error: unknown,
) => {
  let failure = error;
  const kind = workspace.provider_operation_kind ?? "create";
  if (kind === "delete" && !workspace.provider_ref_json && workspace.provider_operation_id) {
    try {
      await removeInactiveWorkspaceProviderDirectory(
        deps,
        {
          projectId: workspace.project_id,
          providerId: workspace.provider_id,
          workspaceId: workspace.id,
        },
        workspace.provider_operation_id,
      );
    } catch (cleanupError) {
      failure = new AggregateError([error, cleanupError], "Provider recovery and owned-directory cleanup failed.");
    }
  }
  await updateReconciledProjection(
    deps,
    workspace,
    failedOperationPatch(workspace, {
      kind,
      operationId: workspace.provider_operation_id ?? crypto.randomUUID(),
      state: pendingStateFor(kind),
      error: failure,
    }),
  );
};
