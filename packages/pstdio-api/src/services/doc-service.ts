import type { createReposDBService } from "pstdio-db";
import type { createDocsStorageService } from "pstdio-storage";

const createDocsError = (code: string, message: string) => Object.assign(new Error(message), { code });

export type DocServiceDeps = {
  docsStorageService: ReturnType<typeof createDocsStorageService>;
  reposDBService: ReturnType<typeof createReposDBService>;
};

export const createDocService = (deps: DocServiceDeps) => {
  const resolveRepoPath = async (projectId: string) => {
    const repos = await deps.reposDBService.listByProject(projectId);
    return repos[0]?.path ?? null;
  };

  const getIndex = async (projectId: string) => {
    const repoPath = await resolveRepoPath(projectId);
    if (!repoPath) throw createDocsError("DOCS_CONFIG_NOT_FOUND", `No repo linked to project ${projectId}.`);
    return deps.docsStorageService.getIndex(repoPath);
  };

  const getDocument = async (projectId: string, link: string) => {
    const repoPath = await resolveRepoPath(projectId);
    if (!repoPath) throw createDocsError("DOCS_CONFIG_NOT_FOUND", `No repo linked to project ${projectId}.`);
    return deps.docsStorageService.getDocument(repoPath, link);
  };

  return { getIndex, getDocument };
};
