import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { ProjectsRouteDeps } from "./deps";
import { attachWorkspaceHandler, attachWorkspaceRoute } from "./endpoints/attach-workspace";
import { createProjectHandler, createProjectRoute } from "./endpoints/create-project";
import { getProjectHandler, getProjectRoute } from "./endpoints/get-project";
import {
  getHarnessParamDefaultsHandler,
  getHarnessParamDefaultsRoute,
  putHarnessParamDefaultsHandler,
  putHarnessParamDefaultsRoute,
} from "./endpoints/harness-param-defaults";
import { listProjectsHandler, listProjectsRoute } from "./endpoints/list-projects";
import { removeProjectHandler, removeProjectRoute } from "./endpoints/remove-project";
import { retryProjectSetupHandler, retryProjectSetupRoute } from "./endpoints/retry-project-setup";
import { updateProjectHandler, updateProjectRoute } from "./endpoints/update-project";

export const createProjectRoutes = (deps: ProjectsRouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  routes.openapi(listProjectsRoute, listProjectsHandler(deps));
  routes.openapi(attachWorkspaceRoute, attachWorkspaceHandler(deps));
  routes.openapi(createProjectRoute, createProjectHandler(deps));
  routes.openapi(retryProjectSetupRoute, retryProjectSetupHandler(deps));
  routes.openapi(getProjectRoute, getProjectHandler(deps));
  routes.openapi(getHarnessParamDefaultsRoute, getHarnessParamDefaultsHandler(deps));
  routes.openapi(putHarnessParamDefaultsRoute, putHarnessParamDefaultsHandler(deps));
  routes.openapi(updateProjectRoute, updateProjectHandler(deps));
  routes.openapi(removeProjectRoute, removeProjectHandler(deps));

  return routes;
};
