import type { WorkspacesRouteDeps } from "./deps";

export const resolveWorkspaceRoot = async (deps: WorkspacesRouteDeps, workspaceId: string) => {
  const workspace = await deps.workspaceService.get(workspaceId);
  if (!workspace) return undefined;
  if (workspace.worktree_path) return { workspace, root: workspace.worktree_path };

  const [repo] = await deps.repoService.listByProject(workspace.project_id);
  return repo?.path ? { workspace, root: repo.path } : undefined;
};
