import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { RouteDeps } from "../deps";
import { clearStartupScriptHandler, clearStartupScriptRoute } from "./endpoints/clear-startup-script";
import { createProjectHandler, createProjectRoute } from "./endpoints/create-project";
import { getProjectHandler, getProjectRoute } from "./endpoints/get-project";
import { getStartupScriptHandler, getStartupScriptRoute } from "./endpoints/get-startup-script";
import { listProjectsHandler, listProjectsRoute } from "./endpoints/list-projects";
import { listReposHandler, listReposRoute } from "./endpoints/list-repos";
import { registerRepoHandler, registerRepoRoute } from "./endpoints/register-repo";
import { removeProjectHandler, removeProjectRoute } from "./endpoints/remove-project";
import { setStartupScriptHandler, setStartupScriptRoute } from "./endpoints/set-startup-script";

export const createProjectRoutes = (deps: RouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  routes.openapi(listProjectsRoute, listProjectsHandler(deps));
  routes.openapi(createProjectRoute, createProjectHandler(deps));
  routes.openapi(getProjectRoute, getProjectHandler(deps));
  routes.openapi(listReposRoute, listReposHandler(deps));
  routes.openapi(registerRepoRoute, registerRepoHandler(deps));
  routes.openapi(removeProjectRoute, removeProjectHandler(deps));
  routes.openapi(getStartupScriptRoute, getStartupScriptHandler(deps));
  routes.openapi(setStartupScriptRoute, setStartupScriptHandler(deps));
  routes.openapi(clearStartupScriptRoute, clearStartupScriptHandler(deps));

  return routes;
};
