import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { RouteDeps } from "../deps";
import { checkAgentAvailabilityHandler, checkAgentAvailabilityRoute } from "./endpoints/check-agent-availability";
import { listAgentsHandler, listAgentsRoute } from "./endpoints/list-agents";
import { removeAgentHandler, removeAgentRoute } from "./endpoints/remove-agent";
import { setupAgentHandler, setupAgentRoute } from "./endpoints/setup-agent";
import { updateAgentHandler, updateAgentRoute } from "./endpoints/update-agent";

export const createAgentRoutes = (deps: RouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  routes.openapi(checkAgentAvailabilityRoute, checkAgentAvailabilityHandler(deps));
  routes.openapi(listAgentsRoute, listAgentsHandler(deps));
  routes.openapi(setupAgentRoute, setupAgentHandler(deps));
  routes.openapi(updateAgentRoute, updateAgentHandler(deps));
  routes.openapi(removeAgentRoute, removeAgentHandler(deps));

  return routes;
};
