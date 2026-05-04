import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { ProjectsRouteDeps } from "./deps";
import { createProjectHandler, createProjectRoute } from "./endpoints/create-project";
import { getProjectHandler, getProjectRoute } from "./endpoints/get-project";
import { listProjectsHandler, listProjectsRoute } from "./endpoints/list-projects";
import { listRepoBranchesHandler, listRepoBranchesRoute } from "./endpoints/list-repo-branches";
import { listReposHandler, listReposRoute } from "./endpoints/list-repos";
import { registerRepoHandler, registerRepoRoute } from "./endpoints/register-repo";
import { removeProjectHandler, removeProjectRoute } from "./endpoints/remove-project";
import { removeRepoHandler, removeRepoRoute } from "./endpoints/remove-repo";
import { updateProjectHandler, updateProjectRoute } from "./endpoints/update-project";

export const createProjectRoutes = (deps: ProjectsRouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  routes.openapi(listProjectsRoute, listProjectsHandler(deps));
  routes.openapi(createProjectRoute, createProjectHandler(deps));
  routes.openapi(getProjectRoute, getProjectHandler(deps));
  routes.openapi(updateProjectRoute, updateProjectHandler(deps));
  routes.openapi(listReposRoute, listReposHandler(deps));
  routes.openapi(listRepoBranchesRoute, listRepoBranchesHandler(deps));
  routes.openapi(registerRepoRoute, registerRepoHandler(deps));
  routes.openapi(removeProjectRoute, removeProjectHandler(deps));
  routes.openapi(removeRepoRoute, removeRepoHandler(deps));

  return routes;
};
