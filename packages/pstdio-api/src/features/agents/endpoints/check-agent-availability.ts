import { createRoute } from "@hono/zod-openapi";
import type { AgentId } from "pstdio-agents";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { availabilitySchema, checkAgentAvailabilityQuerySchema } from "../dto";

export const checkAgentAvailabilityRoute = createRoute({
  method: "get",
  path: "/agents/availability",
  description: "Check whether a coding agent is installed and available.",
  tags: ["Agents"],
  request: {
    query: checkAgentAvailabilityQuerySchema,
  },
  responses: {
    200: {
      description: "Availability status.",
      content: {
        "application/json": {
          schema: availabilitySchema,
        },
      },
    },
  },
});

export const checkAgentAvailabilityHandler = (deps: RouteDeps): AppRouteHandler<typeof checkAgentAvailabilityRoute> => {
  return (c) => {
    const { agent: agentId } = c.req.valid("query");
    const agent = deps.agentRegistry.get(agentId as AgentId);
    const availability = agent ? agent.checkAvailability() : { type: "NOT_FOUND" as const };

    return c.json(availability, 200);
  };
};
