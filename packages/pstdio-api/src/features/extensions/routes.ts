import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { RouteDeps } from "../deps";
import { listExtensionCollectionHandler, listExtensionCollectionRoute } from "./endpoints/list-extension-collection";

export const createExtensionRoutes = (deps: RouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  routes.openapi(listExtensionCollectionRoute, listExtensionCollectionHandler(deps));

  return routes;
};
