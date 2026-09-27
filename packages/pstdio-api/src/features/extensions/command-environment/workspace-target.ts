import type { ExtensionsRouteDeps } from "../deps";

export interface WorkspaceTargetInput {
  projectId: string;
  workspaceId?: string;
  provisioningWorkspaceId?: string;
  eventId?: string;
}

export const resolveLocalWorkspaceTarget = async (
  deps: Pick<ExtensionsRouteDeps, "workspaceService">,
  input: WorkspaceTargetInput,
  kind: "file" | "process",
) => {
  const workspace = input.workspaceId
    ? await deps.workspaceService.get(input.workspaceId)
    : await deps.workspaceService.getDefault(input.projectId);
  const provisioning = workspace?.id === input.provisioningWorkspaceId;
  if (
    !workspace ||
    workspace.project_id !== input.projectId ||
    workspace.execution_kind !== "local" ||
    workspace.deleted_at ||
    (workspace.provider_state && workspace.provider_state !== "ready") ||
    (!provisioning && (workspace.initializing || workspace.setup_error))
  )
    throw new Error(`This workspace has no ready local ${kind} target.`);
  const location = workspace.root_path ? { workspace, root: workspace.root_path } : undefined;
  if (!location) throw new Error(`This workspace has no local ${kind} target.`);
  return location;
};
