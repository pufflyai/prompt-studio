import { join } from "node:path";

export type LinkedRepoExtensionRoot = {
  rootPath: string;
  links: Array<{ projectId: string; repoPath: string }>;
};

type ListLinkedRepoExtensionRootsInput = {
  projectService: { list: () => Promise<Array<{ id: string }>> };
  workspaceService: { getDefault(projectId: string): Promise<{ root_path: string | null } | null> };
};

const repoExtensionsRoot = (repoPath: string) => join(repoPath, ".pstdio", "extensions");

// A repo can be linked to several projects, so registrations are grouped by the on-disk root
// path: one watcher per `.pstdio/extensions` directory, syncing every project linked to it.
export const listLinkedRepoExtensionRoots = async (input: ListLinkedRepoExtensionRootsInput) => {
  const roots = new Map<string, LinkedRepoExtensionRoot>();

  for (const project of await input.projectService.list()) {
    const workspace = await input.workspaceService.getDefault(project.id);
    if (workspace?.root_path) {
      const rootPath = repoExtensionsRoot(workspace.root_path);
      const root = roots.get(rootPath) ?? { rootPath, links: [] };
      root.links.push({ projectId: project.id, repoPath: workspace.root_path });
      roots.set(rootPath, root);
    }
  }

  return [...roots.values()]
    .sort((left, right) => left.rootPath.localeCompare(right.rootPath))
    .map((root) => ({
      rootPath: root.rootPath,
      links: root.links.sort((left, right) => left.projectId.localeCompare(right.projectId)),
    }));
};
