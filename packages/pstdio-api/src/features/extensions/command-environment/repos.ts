import { join, resolve } from "node:path";
import type { RepoContext } from "pstdio-api-contracts/extension-kernel";
import type { CommandRunnerEnvironment } from "pstdio-extensions";
import type { ExtensionsRouteDeps } from "../deps";

type WorkspaceRepoProjection = {
  provider_params_json?: Record<string, unknown>;
  provider_ref_json?: { data?: Record<string, unknown> } | null;
};

const nonEmptyString = (value: unknown) => (typeof value === "string" && value.trim() ? value : undefined);

export const resolveWorkspaceRepoId = (workspace: WorkspaceRepoProjection) =>
  nonEmptyString(workspace.provider_params_json?.repo_id) ?? nonEmptyString(workspace.provider_ref_json?.data?.repo_id);

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
      const repo = (await deps.repoService.listByProject(projectId)).find((candidate) => candidate.id === repoId);
      if (!repo) throw new Error(`Repo not found: ${repoId}`);
      return toContext(repo);
    },
    async getDefault() {
      const [repo] = await deps.repoService.listByProject(projectId);
      return repo ? toContext(repo, "default") : undefined;
    },
    async resolvePath(repoId, relativePath) {
      const repo = (await deps.repoService.listByProject(projectId)).find((candidate) => candidate.id === repoId);
      if (!repo) throw new Error(`Repo not found: ${repoId}`);
      return join(repo.path, relativePath);
    },
  };
};

// Resolves the on-disk path of a repo from trusted sources, never the client-supplied
// path directly. The repo must be registered for the project, guarding ctx.repoFiles
// against forged execute requests pointing outside it. A worktree-backed workspace is a
// legitimate working tree of the registered repo, so its own path is honored only when
// it matches a known workspace for the project — otherwise we fall back to the repo root.
export const resolveRegisteredRepoPath = async (deps: ExtensionsRouteDeps, projectId: string, repo: RepoContext) => {
  const repos = await deps.repoService.listByProject(projectId);
  const registered = repos.find((candidate) => candidate.id === repo.repoId);
  if (!registered) throw new Error(`Repo ${repo.repoId} is not registered for project ${projectId}`);
  if (resolve(repo.path) === resolve(registered.path)) return registered.path;

  const workspaces = await deps.workspaceService.list(projectId);
  const matched = workspaces.find(
    (workspace) =>
      resolveWorkspaceRepoId(workspace) === repo.repoId &&
      workspace.worktree_path &&
      resolve(workspace.worktree_path) === resolve(repo.path),
  );
  return matched ? resolve(repo.path) : registered.path;
};
