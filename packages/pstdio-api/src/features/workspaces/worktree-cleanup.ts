import { existsSync } from "node:fs";
import { realpath, rm } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { removeWorktreeAndBranch } from "pstdio-wt";
import type { WorkspacesRouteDeps } from "./deps";
import { worktreeProviderId } from "./workspace-provider-identity";
import { resolveWorkspacesRoot } from "./worktree-setup";

export const workspaceGitPaths = (workspace: {
  provider_id: string;
  provider_ref_json?: { data: Record<string, unknown> } | null;
}) => {
  if (workspace.provider_id !== worktreeProviderId) return undefined;
  const data = workspace.provider_ref_json?.data;
  if (typeof data?.sourceRoot !== "string" || typeof data.worktreeRoot !== "string") return undefined;
  return { sourceRoot: data.sourceRoot, worktreeRoot: data.worktreeRoot };
};

const canonicalPath = async (path: string) => {
  let current = resolve(path);
  const missing: string[] = [];
  while (true) {
    try {
      return resolve(await realpath(current), ...missing);
    } catch (error) {
      const parent = dirname(current);
      if ((error as NodeJS.ErrnoException).code !== "ENOENT" || parent === current) throw error;
      missing.unshift(basename(current));
      current = parent;
    }
  }
};

const isManagedWorktreePath = async (path: string) => {
  const rel = relative(await canonicalPath(resolveWorkspacesRoot()), await canonicalPath(path));
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
};

export const cleanupWorkspaceWorktree = async (
  _deps: Pick<WorkspacesRouteDeps, "workspaceService">,
  workspace: {
    provider_id: string;
    provider_ref_json?: { data: Record<string, unknown> } | null;
    branch: string | null;
  },
) => {
  const paths = workspaceGitPaths(workspace);
  if (
    !paths ||
    !(await isManagedWorktreePath(paths.worktreeRoot)) ||
    (await canonicalPath(paths.worktreeRoot)) === (await canonicalPath(paths.sourceRoot))
  )
    return false;
  if (!existsSync(paths.worktreeRoot)) return true;
  if (!existsSync(paths.sourceRoot)) {
    await rm(paths.worktreeRoot, { recursive: true, force: true });
    return true;
  }
  if (!workspace.branch) return false;
  await removeWorktreeAndBranch({
    repoRoot: paths.sourceRoot,
    path: paths.worktreeRoot,
    branch: workspace.branch,
    force: true,
  });
  return true;
};
