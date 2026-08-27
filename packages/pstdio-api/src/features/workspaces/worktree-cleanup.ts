import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { removeWorktreeAndBranch } from "pstdio-wt";
import type { WorkspacesRouteDeps } from "./deps";
import { resolveWorkspacesRoot } from "./worktree-setup";

type WorkspaceForCleanup = {
  project_id: string;
  workspace_shorthand: string;
  branch: string | null;
  worktree_path: string | null;
};

const isManagedWorktreePath = (path: string) => {
  const relativePath = relative(resolveWorkspacesRoot(), resolve(path));
  return (
    relativePath !== "" && relativePath !== ".." && !relativePath.startsWith(`..${sep}`) && !isAbsolute(relativePath)
  );
};

export const cleanupWorkspaceWorktree = async (
  deps: Pick<WorkspacesRouteDeps, "repoService">,
  workspace: WorkspaceForCleanup,
) => {
  if (!workspace.worktree_path) return false;

  const repos = await deps.repoService.listByProject(workspace.project_id);
  if (repos.length === 0) return false;
  if (repos.some((repo) => resolve(repo.path) === resolve(workspace.worktree_path!))) return false;
  if (!existsSync(workspace.worktree_path)) return true;
  if (repos.every((repo) => !existsSync(repo.path)) && isManagedWorktreePath(workspace.worktree_path)) {
    try {
      await rm(workspace.worktree_path, { recursive: true, force: true });
      return true;
    } catch {
      return false;
    }
  }

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
