import { join } from "node:path";
import type { createWorkspaceService } from "../../services/workspace-service";
import { hasPendingRestoredFolderSetup } from "../workspaces/workspace-provider-identity";

export type RepoExtensionRoot = {
  rootPath: string;
  projects: Array<{ projectId: string; repoPath: string }>;
};

type ListRepoExtensionRootsInput = {
  projectService: { list: () => Promise<Array<{ id: string }>> };
  workspaceService: { getDefault(projectId: string): Promise<RepoExtensionWorkspace | null> };
};

type DefaultWorkspace = NonNullable<Awaited<ReturnType<ReturnType<typeof createWorkspaceService>["getDefault"]>>>;
export type RepoExtensionWorkspace = Pick<
  DefaultWorkspace,
  | "root_path"
  | "execution_kind"
  | "provider_id"
  | "provider_state"
  | "provider_params_json"
  | "initializing"
  | "setup_error"
>;

export const readyRepoExtensionFolder = (workspace: RepoExtensionWorkspace | null) => {
  if (workspace?.provider_state !== "ready" || workspace.initializing || workspace.setup_error) return null;
  if (hasPendingRestoredFolderSetup(workspace)) return null;
  return workspace.execution_kind === "local" ? workspace.root_path : null;
};

const repoExtensionsRoot = (repoPath: string) => join(repoPath, ".pstdio", "extensions");

// Projects that shared a repository before folder projects can still open the same folder, so
// registrations are grouped by the on-disk root: one watcher per `.pstdio/extensions` directory.
export const listRepoExtensionRoots = async (input: ListRepoExtensionRootsInput) => {
  const roots = new Map<string, RepoExtensionRoot>();

  for (const project of await input.projectService.list()) {
    const repoPath = readyRepoExtensionFolder(await input.workspaceService.getDefault(project.id));
    if (!repoPath) continue;
    const rootPath = repoExtensionsRoot(repoPath);
    const root = roots.get(rootPath) ?? { rootPath, projects: [] };
    root.projects.push({ projectId: project.id, repoPath });
    roots.set(rootPath, root);
  }

  return [...roots.values()]
    .sort((left, right) => left.rootPath.localeCompare(right.rootPath))
    .map((root) => ({
      rootPath: root.rootPath,
      projects: root.projects.sort((left, right) => left.projectId.localeCompare(right.projectId)),
    }));
};
