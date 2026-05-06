import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { ExtensionsRouteDeps } from "./deps";
import { enableInstalledExtensionHandler, enableInstalledExtensionRoute } from "./endpoints/enable-installed-extension";

export const createExtensionRoutes = (deps: ExtensionsRouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  routes.openapi(enableInstalledExtensionRoute, enableInstalledExtensionHandler(deps));

  return routes;
};
