import type { RouteDeps } from "../deps";
import { ensureProjectRepoScaffolding } from "./bootstrap-project-repo";

type Deps = Pick<RouteDeps, "filesRoot" | "projectService" | "repoService">;

export const ensureProjectReposScaffolded = async (deps: Deps) => {
  const projects = await deps.projectService.list();

  for (const project of projects) {
    const repos = await deps.repoService.listByProject(project.id);
    await Promise.all(repos.map((repo) => ensureProjectRepoScaffolding(repo.path, deps.filesRoot)));
  }
};
