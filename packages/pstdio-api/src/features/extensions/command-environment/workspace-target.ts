import { ProjectFolderMissingError } from "../../projects/project-folder-missing";
import type { ExtensionsRouteDeps } from "../deps";

export class WorkspaceTargetUnavailableError extends Error {}

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
    throw new WorkspaceTargetUnavailableError(`This workspace has no ready local ${kind} target.`);
  if (workspace.root_path) return { workspace, root: workspace.root_path };
  if (workspace.is_default) throw new ProjectFolderMissingError();
  throw new WorkspaceTargetUnavailableError(`This workspace has no local ${kind} target.`);
};
