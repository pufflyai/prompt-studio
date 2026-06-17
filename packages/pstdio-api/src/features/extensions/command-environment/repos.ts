import { join } from "node:path";
import type { RepoContext } from "pstdio-api-contracts/extension-kernel";
import type { CommandRunnerEnvironment } from "pstdio-extensions";
import type { ExtensionsRouteDeps } from "../deps";

export const createReposApi = (deps: ExtensionsRouteDeps, projectId: string): CommandRunnerEnvironment["repos"] => {
  const toContext = (repo: { id: string; path: string }, role?: "default") => ({
    projectId,
    repoId: repo.id,
    path: repo.path,
    role,
  });

  return {
    async list() {
      const repos = await deps.repoService.listByProject(projectId);
      return repos.map((repo, index) => toContext(repo, index === 0 ? "default" : undefined));
    },
    async get(repoId) {
      const repo = await deps.repoService.get(repoId);
      if (!repo) throw new Error(`Repo not found: ${repoId}`);
      return toContext(repo);
    },
    async getDefault() {
      const [repo] = await deps.repoService.listByProject(projectId);
      return repo ? toContext(repo, "default") : undefined;
    },
    async resolvePath(repoId, relativePath) {
      const repo = await deps.repoService.get(repoId);
      if (!repo) throw new Error(`Repo not found: ${repoId}`);
      return join(repo.path, relativePath);
    },
  };
};

// Resolves the on-disk path of a repo from the registered project repos, never
// trusting a client-supplied path. The repo must be registered for the project,
// guarding ctx.repoFiles against forged execute requests pointing outside it.
export const resolveRegisteredRepoPath = async (deps: ExtensionsRouteDeps, projectId: string, repo: RepoContext) => {
  const repos = await deps.repoService.listByProject(projectId);
  const registered = repos.find((candidate) => candidate.id === repo.repoId);
  if (!registered) throw new Error(`Repo ${repo.repoId} is not registered for project ${projectId}`);
  return registered.path;
};
