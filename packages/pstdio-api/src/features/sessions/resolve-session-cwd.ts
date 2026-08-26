import type { SessionsRouteDeps } from "./deps";

export const resolveSessionCwd = async (
  deps: Pick<SessionsRouteDeps, "workspaceService" | "repoService">,
  projectId: string,
  workspaceId?: string | null,
) => {
  if (workspaceId) {
    const workspace = await deps.workspaceService.get(workspaceId);
    if (!workspace || workspace.provider_state !== "ready" || workspace.execution_kind !== "local") return undefined;
    if (workspace.setup_error) return undefined;
    if (workspace.worktree_path) return workspace.worktree_path;
    if (workspace.provider_id !== "pstdio.root" && !workspace.is_default) return undefined;
  }

  const repos = await deps.repoService.listByProject(projectId);
  if (repos.length > 0) return repos[0].path;

  return undefined;
};
