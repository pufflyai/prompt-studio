import { cleanupProviderBackedWorkspace } from "../workspaces/workspace-provider-lifecycle";
import { isBuiltInProviderId, rootProviderId } from "../workspaces/workspace-provider-service";
import type { ProjectsRouteDeps } from "./deps";

export const cleanupProjectArtifacts = async (
  deps: ProjectsRouteDeps,
  projectId: string,
  options: {
    deleteProviderWorkspace?: typeof cleanupProviderBackedWorkspace;
    removeProjectStorage: (projectId: string) => void;
  },
) => {
  const projectWorkspaces = await deps.workspaceService.listForProviderReconciliation(projectId);
  const remove = options.deleteProviderWorkspace ?? cleanupProviderBackedWorkspace;

  for (const ws of projectWorkspaces) {
    if (ws.is_default || ws.provider_id === rootProviderId) continue;
    const removedWorktree = await remove(deps, ws);
    if (isBuiltInProviderId(ws.provider_id) && ws.worktree_path && !removedWorktree) {
      throw new Error(`Workspace worktree could not be removed: ${ws.id}`);
    }
    await deps.workspaceService.softDelete(ws.id);
  }

  options.removeProjectStorage(projectId);
};
