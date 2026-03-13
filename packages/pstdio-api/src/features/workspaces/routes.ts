import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { RouteDeps } from "../deps";
import { createWorkspaceHandler, createWorkspaceRoute } from "./endpoints/create-workspace";
import { deleteWorkspaceHandler, deleteWorkspaceRoute } from "./endpoints/delete-workspace";
import { getStartupLogHandler, getStartupLogRoute } from "./endpoints/get-startup-log";
import { getWorkspaceHandler, getWorkspaceRoute } from "./endpoints/get-workspace";
import { getWorkspaceDiffHandler, getWorkspaceDiffRoute } from "./endpoints/get-workspace-diff";
import { listWorkspacesHandler, listWorkspacesRoute } from "./endpoints/list-workspaces";
import { setStartupLogHandler, setStartupLogRoute } from "./endpoints/set-startup-log";

export const createWorkspaceRoutes = (deps: RouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  routes.openapi(createWorkspaceRoute, createWorkspaceHandler(deps));
  routes.openapi(listWorkspacesRoute, listWorkspacesHandler(deps));
  routes.openapi(getWorkspaceRoute, getWorkspaceHandler(deps));
  routes.openapi(getWorkspaceDiffRoute, getWorkspaceDiffHandler(deps));
  routes.openapi(deleteWorkspaceRoute, deleteWorkspaceHandler(deps));
  routes.openapi(setStartupLogRoute, setStartupLogHandler(deps));
  routes.openapi(getStartupLogRoute, getStartupLogHandler(deps));

  return routes;
};
