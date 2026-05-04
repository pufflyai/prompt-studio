import { removeWorktreeAndBranch } from "pstdio-wt";
import type { WorkspacesRouteDeps } from "./deps";

type WorkspaceForCleanup = {
  project_id: string;
  workspace_shorthand: string;
  branch: string | null;
  worktree_path: string | null;
};

export const cleanupWorkspaceWorktree = async (
  deps: Pick<WorkspacesRouteDeps, "repoService">,
  workspace: WorkspaceForCleanup,
) => {
  if (!workspace.worktree_path) return false;

  const repos = await deps.repoService.listByProject(workspace.project_id);
  if (repos.length === 0) return false;

  const branch = workspace.branch ?? `workspace/${workspace.workspace_shorthand}`;

  for (const repo of repos) {
    try {
      await removeWorktreeAndBranch({
        repoRoot: repo.path,
        path: workspace.worktree_path,
        branch,
        force: true,
      });
      return true;
    } catch {
      // Ignore and try the next repo.
    }
  }

  return false;
};
