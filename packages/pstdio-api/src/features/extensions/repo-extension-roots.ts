import { join } from "node:path";

export type RepoExtensionRoot = {
  rootPath: string;
  projects: Array<{ projectId: string; repoPath: string }>;
};

type ListRepoExtensionRootsInput = {
  projectService: { list: () => Promise<Array<{ id: string }>> };
  workspaceService: { getDefault(projectId: string): Promise<{ root_path: string | null } | null> };
};

const repoExtensionsRoot = (repoPath: string) => join(repoPath, ".pstdio", "extensions");

// Projects that shared a repository before folder projects can still open the same folder, so
// registrations are grouped by the on-disk root: one watcher per `.pstdio/extensions` directory.
export const listRepoExtensionRoots = async (input: ListRepoExtensionRootsInput) => {
  const roots = new Map<string, RepoExtensionRoot>();

  for (const project of await input.projectService.list()) {
    const workspace = await input.workspaceService.getDefault(project.id);
    if (workspace?.root_path) {
      const rootPath = repoExtensionsRoot(workspace.root_path);
      const root = roots.get(rootPath) ?? { rootPath, projects: [] };
      root.projects.push({ projectId: project.id, repoPath: workspace.root_path });
      roots.set(rootPath, root);
    }
  }

  return [...roots.values()]
    .sort((left, right) => left.rootPath.localeCompare(right.rootPath))
    .map((root) => ({
      rootPath: root.rootPath,
      projects: root.projects.sort((left, right) => left.projectId.localeCompare(right.projectId)),
    }));
};
