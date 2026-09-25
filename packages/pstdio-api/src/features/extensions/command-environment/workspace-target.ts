import type { RepoContext } from "pstdio-api-contracts/extension-kernel";
import type { ExtensionsRouteDeps } from "../deps";
import { resolveLegacyWorkspaceLocation } from "./legacy-workspace-location";

export interface WorkspaceTargetInput {
  projectId: string;
  workspaceId?: string;
  provisioningWorkspaceId?: string;
  eventId?: string;
  repo?: RepoContext;
}

export const resolveLocalWorkspaceTarget = async (
  deps: Pick<ExtensionsRouteDeps, "workspaceService" | "repoService">,
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
  const location = await resolveLegacyWorkspaceLocation(deps, workspace, input);
  if (!location) throw new Error(`This workspace has no local ${kind} target.`);
  return location;
};
