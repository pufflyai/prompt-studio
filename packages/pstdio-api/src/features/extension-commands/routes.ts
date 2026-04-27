import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { RouteDeps } from "../deps";
import { executeExtensionCommandHandler, executeExtensionCommandRoute } from "./endpoints/execute-extension-command";

export const createExtensionCommandRoutes = (deps: RouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  routes.openapi(executeExtensionCommandRoute, executeExtensionCommandHandler(deps));

  return routes;
};
