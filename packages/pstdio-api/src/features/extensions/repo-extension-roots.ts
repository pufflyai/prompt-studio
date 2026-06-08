import { join } from "node:path";

export type LinkedRepoExtensionRoot = {
  rootPath: string;
  links: Array<{ projectId: string; repoPath: string }>;
};

type ListLinkedRepoExtensionRootsInput = {
  projectService: { list: () => Promise<Array<{ id: string }>> };
  repoService: { listByProject: (projectId: string) => Promise<Array<{ path: string }>> };
};

const repoExtensionsRoot = (repoPath: string) => join(repoPath, ".pstdio", "extensions");

// A repo can be linked to several projects, so registrations are grouped by the on-disk root
// path: one watcher per `.pstdio/extensions` directory, syncing every project linked to it.
export const listLinkedRepoExtensionRoots = async (input: ListLinkedRepoExtensionRootsInput) => {
  const roots = new Map<string, LinkedRepoExtensionRoot>();

  for (const project of await input.projectService.list()) {
    for (const repo of await input.repoService.listByProject(project.id)) {
      const rootPath = repoExtensionsRoot(repo.path);
      const root = roots.get(rootPath) ?? { rootPath, links: [] };
      root.links.push({ projectId: project.id, repoPath: repo.path });
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
