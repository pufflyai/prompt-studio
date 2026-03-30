import type { createReposDBService } from "pstdio-db";

export type RepoServiceDeps = {
  reposDBService: ReturnType<typeof createReposDBService>;
};

export const createRepoService = (deps: RepoServiceDeps) => ({
  ...deps.reposDBService,
});
