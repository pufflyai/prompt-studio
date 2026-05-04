import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { PluginsRouteDeps } from "./deps";
import { listPluginsHandler, listPluginsRoute } from "./endpoints/list-plugins";
import { registerPluginsHandler, registerPluginsRoute } from "./endpoints/register-plugins";

export const createPluginRoutes = (deps: PluginsRouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  routes.openapi(listPluginsRoute, listPluginsHandler(deps));
  routes.openapi(registerPluginsRoute, registerPluginsHandler(deps));

  return routes;
};
