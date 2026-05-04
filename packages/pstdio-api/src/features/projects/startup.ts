import { ensureProjectRepoScaffolding } from "./bootstrap-project-repo";
import type { ProjectsRouteDeps } from "./deps";

type Deps = Pick<ProjectsRouteDeps, "filesRoot" | "projectService" | "repoService">;

export const ensureProjectReposScaffolded = async (deps: Deps) => {
  const projects = await deps.projectService.list();

  for (const project of projects) {
    const repos = await deps.repoService.listByProject(project.id);
    await Promise.all(repos.map((repo) => ensureProjectRepoScaffolding(repo.path, deps.filesRoot)));
  }
};
