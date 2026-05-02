import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { RouteDeps } from "../deps";
import { checkExtensionsHandler, checkExtensionsRoute } from "./endpoints/check";

export const createExtensionRoutes = (deps: RouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  routes.openapi(checkExtensionsRoute, checkExtensionsHandler(deps));

  return routes;
};
