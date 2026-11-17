import type { WorkspacesRouteDeps } from "./deps";
import type { WorkspaceRecord } from "./workspace-provider-projection";

/** Replay only the accepted operation; discovery choices may have changed since admission. */
export const getAcceptedProviderOperation = async (deps: WorkspacesRouteDeps, workspace: WorkspaceRecord) => {
  const current = await deps.workspaceService.get(workspace.id);
  return current &&
    !current.deleted_at &&
    current.provider_operation_id === workspace.provider_operation_id &&
    current.provider_operation_kind === workspace.provider_operation_kind
    ? current
    : undefined;
};
