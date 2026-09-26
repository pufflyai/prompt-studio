import { ensureProjectRepoScaffolding } from "./bootstrap-project-repo";
import type { ProjectsRouteDeps } from "./deps";
import { resolveCurrentBranch } from "./resolve-current-branch";

type Deps = Pick<ProjectsRouteDeps, "projectService" | "repoService" | "workspaceService">;

export const ensureProjectReposScaffolded = async (deps: Deps) => {
  const projects = await deps.projectService.list();

  for (const project of projects) {
    const repos = await deps.repoService.listByProject(project.id);
    await Promise.all(repos.map(() => ensureProjectRepoScaffolding()));
    const repo = repos[0];
    if (repo && !(await deps.workspaceService.getDefault(project.id))) {
      await deps.workspaceService.ensureDefault({
        project_id: project.id,
        name: repo.display_name ?? repo.name,
        branch: await resolveCurrentBranch(repo.path),
      });
    }
  }
};
