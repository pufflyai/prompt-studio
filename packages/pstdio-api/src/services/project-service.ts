import type { createProjectsDBService } from "pstdio-db";

export type ProjectServiceDeps = {
  projectsDBService: ReturnType<typeof createProjectsDBService>;
};

export const createProjectService = (deps: ProjectServiceDeps) => ({
  ...deps.projectsDBService,
});
