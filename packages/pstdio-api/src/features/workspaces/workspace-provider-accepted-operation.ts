import type { WorkspacesRouteDeps } from "./deps";
import type { WorkspaceRecord } from "./workspace-provider-projection";

export const getLiveProviderWorkspace = async (
  deps: WorkspacesRouteDeps,
  workspace: Pick<WorkspaceRecord, "id" | "project_id">,
) => {
  const current = await deps.workspaceService.get(workspace.id);
  return current && !current.deleted_at && current.project_id === workspace.project_id ? current : undefined;
};

/** Replay only the accepted operation; discovery choices may have changed since admission. */
export const getAcceptedProviderOperation = async (deps: WorkspacesRouteDeps, workspace: WorkspaceRecord) => {
  const current = await getLiveProviderWorkspace(deps, workspace);
  return current &&
    current.provider_operation_id === workspace.provider_operation_id &&
    current.provider_operation_kind === workspace.provider_operation_kind
    ? current
    : undefined;
};
