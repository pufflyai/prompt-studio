import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { RouteDeps } from "../deps";
import { checkAgentAvailabilityHandler, checkAgentAvailabilityRoute } from "./endpoints/check-agent-availability";
import { listAgentInfoHandler, listAgentInfoRoute } from "./endpoints/list-agent-info";
import { listAgentModelsHandler, listAgentModelsRoute } from "./endpoints/list-agent-models";
import { listAgentsHandler, listAgentsRoute } from "./endpoints/list-agents";
import { removeAgentHandler, removeAgentRoute } from "./endpoints/remove-agent";
import { setupAgentHandler, setupAgentRoute } from "./endpoints/setup-agent";
import { setupAvailableAgentsHandler, setupAvailableAgentsRoute } from "./endpoints/setup-available-agents";
import { updateAgentHandler, updateAgentRoute } from "./endpoints/update-agent";

export const createAgentRoutes = (deps: RouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  routes.openapi(checkAgentAvailabilityRoute, checkAgentAvailabilityHandler(deps));
  routes.openapi(listAgentInfoRoute, listAgentInfoHandler(deps));
  routes.openapi(listAgentModelsRoute, listAgentModelsHandler(deps));
  routes.openapi(listAgentsRoute, listAgentsHandler(deps));
  routes.openapi(setupAgentRoute, setupAgentHandler(deps));
  routes.openapi(setupAvailableAgentsRoute, setupAvailableAgentsHandler(deps));
  routes.openapi(updateAgentRoute, updateAgentHandler(deps));
  routes.openapi(removeAgentRoute, removeAgentHandler(deps));

  return routes;
};
