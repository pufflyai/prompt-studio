import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { RouteDeps } from "../deps";
import { listPluginsHandler, listPluginsRoute } from "./endpoints/list-plugins";

export const createPluginRoutes = (deps: RouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  routes.openapi(listPluginsRoute, listPluginsHandler(deps));

  return routes;
};
