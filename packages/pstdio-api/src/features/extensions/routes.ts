import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { RouteDeps } from "../deps";
import { checkExtensionsHandler, checkExtensionsRoute } from "./endpoints/check";
import { executeCommandHandler, executeCommandRoute } from "./endpoints/execute-command";
import { syncExtensionSkillsHandler, syncExtensionSkillsRoute } from "./endpoints/sync-skills";

export const createExtensionRoutes = (deps: RouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  routes.openapi(checkExtensionsRoute, checkExtensionsHandler(deps));
  routes.openapi(executeCommandRoute, executeCommandHandler(deps));
  routes.openapi(syncExtensionSkillsRoute, syncExtensionSkillsHandler(deps));

  return routes;
};
