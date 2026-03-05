import type { RouteDeps } from "../deps";

// Resolves the working directory for a session.
// Priority: workspace.worktree_path → first project repo path → undefined
export const resolveSessionCwd = async (
  deps: Pick<RouteDeps, "workspacesService" | "reposService" | "db">,
  projectId: string,
  workspaceId?: string | null,
) => {
  if (workspaceId) {
    const workspace = await deps.workspacesService.get(workspaceId);
    if (workspace?.worktree_path) return workspace.worktree_path;
  }

  const repos = await deps.reposService.listByProject(projectId);
  if (repos.length > 0) return repos[0].path;

  return undefined;
};
