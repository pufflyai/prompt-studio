import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { RouteDeps } from "../deps";
import { createProjectHandler, createProjectRoute } from "./endpoints/create-project";
import { getProjectHandler, getProjectRoute } from "./endpoints/get-project";
import { listProjectsHandler, listProjectsRoute } from "./endpoints/list-projects";
import { listRepoBranchesHandler, listRepoBranchesRoute } from "./endpoints/list-repo-branches";
import { listReposHandler, listReposRoute } from "./endpoints/list-repos";
import { registerRepoHandler, registerRepoRoute } from "./endpoints/register-repo";
import { removeProjectHandler, removeProjectRoute } from "./endpoints/remove-project";

export const createProjectRoutes = (deps: RouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  routes.openapi(listProjectsRoute, listProjectsHandler(deps));
  routes.openapi(createProjectRoute, createProjectHandler(deps));
  routes.openapi(getProjectRoute, getProjectHandler(deps));
  routes.openapi(listReposRoute, listReposHandler(deps));
  routes.openapi(listRepoBranchesRoute, listRepoBranchesHandler(deps));
  routes.openapi(registerRepoRoute, registerRepoHandler(deps));
  routes.openapi(removeProjectRoute, removeProjectHandler(deps));

  return routes;
};
