import { resolveWorkspaceExecutionTarget } from "../workspaces/workspace-provider-execution-target";
import type { SessionsRouteDeps } from "./deps";

export const resolveSessionCwd = async (
  deps: Pick<SessionsRouteDeps, "workspaceService">,
  projectId: string,
  workspaceId?: string | null,
) => {
  const workspace = workspaceId
    ? await deps.workspaceService.get(workspaceId)
    : await deps.workspaceService.getDefault(projectId);
  if (!workspace || workspace.project_id !== projectId) return undefined;
  return (await resolveWorkspaceExecutionTarget(deps, workspace.id))?.root;
};
