import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { RouteDeps } from "../deps";
import { executeActionHandler, executeActionRoute } from "./endpoints/execute-action";
import { listActionsHandler, listActionsRoute } from "./endpoints/list-actions";

export const createActionRoutes = (deps: RouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  routes.openapi(listActionsRoute, listActionsHandler(deps));
  routes.openapi(executeActionRoute, executeActionHandler(deps));

  return routes;
};
