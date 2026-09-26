import { realpath } from "node:fs/promises";
import { join, resolve } from "node:path";
import { resolvePstdioWorkspacesPath } from "pstdio-paths";
import { findWorktreeByBranch, git } from "pstdio-wt";
import type { WorkspacesRouteDeps } from "./deps";
import { rootProviderId, worktreeProviderId } from "./workspace-provider-identity";

type WorkspaceRecord = NonNullable<Awaited<ReturnType<WorkspacesRouteDeps["workspaceService"]["get"]>>>;

const canonicalPath = async (path: string) => realpath(path).catch(() => null);

const commonDirectory = async (path: string) => {
  try {
    return await canonicalPath(resolve(path, await git(path, ["rev-parse", "--git-common-dir"])));
  } catch {
    return null;
  }
};

// Migration 0026 labelled older worktrees as root. Remove this read projection at the alpha.11 migration.
export const projectLegacyWorktreeProvider = async (
  deps: Pick<WorkspacesRouteDeps, "repoService">,
  workspace: WorkspaceRecord,
) => {
  if (
    workspace.execution_kind !== "local" ||
    workspace.provider_id !== rootProviderId ||
    workspace.is_default ||
    !workspace.worktree_path ||
    workspace.branch !== `workspace/${workspace.workspace_shorthand}`
  ) {
    return workspace;
  }

  const [root, managedRoot] = await Promise.all([
    canonicalPath(workspace.worktree_path),
    canonicalPath(join(resolvePstdioWorkspacesPath(), workspace.workspace_shorthand)),
  ]);
  if (!root || root !== managedRoot) return workspace;
  const folders = await deps.repoService.listByProject(workspace.project_id);
  const sources = await Promise.all(folders.map((folder) => canonicalPath(folder.path)));
  if (sources.includes(root)) return workspace;
  const common = await commonDirectory(root);
  if (!common) return workspace;
  const worktree = await findWorktreeByBranch(root, workspace.branch).catch(() => null);
  if (!worktree || (await canonicalPath(worktree.worktree)) !== root) return workspace;

  for (const sourceRoot of sources) {
    if (sourceRoot && (await commonDirectory(sourceRoot)) === common) {
      return {
        ...workspace,
        provider_id: worktreeProviderId,
        provider_ref_json: { version: 1, data: { sourceRoot, worktreeRoot: root, relativePath: "" } },
      };
    }
  }
  return workspace;
};
