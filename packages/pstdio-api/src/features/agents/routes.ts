import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { AgentsRouteDeps } from "./deps";
import { checkAgentAvailabilityHandler, checkAgentAvailabilityRoute } from "./endpoints/check-agent-availability";
import { listAgentInfoHandler, listAgentInfoRoute } from "./endpoints/list-agent-info";
import { listAgentModelsHandler, listAgentModelsRoute } from "./endpoints/list-agent-models";

export const createAgentRoutes = (deps: AgentsRouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  routes.openapi(checkAgentAvailabilityRoute, checkAgentAvailabilityHandler(deps));
  routes.openapi(listAgentInfoRoute, listAgentInfoHandler(deps));
  routes.openapi(listAgentModelsRoute, listAgentModelsHandler(deps));

  return routes;
};
