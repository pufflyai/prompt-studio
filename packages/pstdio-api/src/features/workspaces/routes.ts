import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { RouteDeps } from "../deps";
import { createWorkspaceHandler, createWorkspaceRoute } from "./endpoints/create-workspace";
import { deleteWorkspaceHandler, deleteWorkspaceRoute } from "./endpoints/delete-workspace";
import { getWorkspaceHandler, getWorkspaceRoute } from "./endpoints/get-workspace";
import { listWorkspacesHandler, listWorkspacesRoute } from "./endpoints/list-workspaces";

export const createWorkspaceRoutes = (deps: RouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  routes.openapi(createWorkspaceRoute, createWorkspaceHandler(deps));
  routes.openapi(listWorkspacesRoute, listWorkspacesHandler(deps));
  routes.openapi(getWorkspaceRoute, getWorkspaceHandler(deps));
  routes.openapi(deleteWorkspaceRoute, deleteWorkspaceHandler(deps));

  return routes;
};
