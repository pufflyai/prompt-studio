import { OpenAPIHono } from "@hono/zod-openapi";
import { upgradeWebSocket } from "hono/bun";
import type { AppBindings } from "../../types";
import { isTerminalWebSocketOriginAllowed } from "../terminal/routes";
import { createHarnessAuthenticationWebSocketEvents } from "./authentication-socket";
import type { AgentsRouteDeps } from "./deps";
import { agentAuthenticationHandler, agentAuthenticationRoute } from "./endpoints/authentication";
import { checkAgentAvailabilityHandler, checkAgentAvailabilityRoute } from "./endpoints/check-agent-availability";
import { listAgentInfoHandler, listAgentInfoRoute } from "./endpoints/list-agent-info";
import { listAgentModelsHandler, listAgentModelsRoute } from "./endpoints/list-agent-models";
import { queryAgentsHandler, queryAgentsRoute, queryModelsHandler, queryModelsRoute } from "./endpoints/query-agents";

export const createAgentRoutes = (deps: AgentsRouteDeps, options: { allowedOrigins?: string[] } = {}) => {
  const routes = new OpenAPIHono<AppBindings>();

  routes.openapi(agentAuthenticationRoute, agentAuthenticationHandler(deps));
  routes.use("/agents/authentication", async (c, next) => {
    if (!isTerminalWebSocketOriginAllowed(c.req.raw, options.allowedOrigins))
      return c.json({ error: "Forbidden" }, 403);
    await next();
  });
  routes.get(
    "/agents/authentication",
    upgradeWebSocket(() => createHarnessAuthenticationWebSocketEvents(deps)),
  );

  routes.openapi(checkAgentAvailabilityRoute, checkAgentAvailabilityHandler(deps));
  routes.openapi(queryAgentsRoute, queryAgentsHandler(deps));
  routes.openapi(queryModelsRoute, queryModelsHandler(deps));
  routes.openapi(listAgentInfoRoute, listAgentInfoHandler(deps));
  routes.openapi(listAgentModelsRoute, listAgentModelsHandler(deps));

  return routes;
};
