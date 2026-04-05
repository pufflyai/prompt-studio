import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { agentInfoListResponseSchema } from "../dto";

export const listAgentInfoRoute = createRoute({
  method: "get",
  path: "/agents/info",
  description: "List all known agents with availability status.",
  tags: ["Agents"],

  request: {
    query: z.object({}).strict(),
  },
  responses: {
    200: {
      description: "List of known agents with availability.",
      content: { "application/json": { schema: agentInfoListResponseSchema } },
    },
  },
});

export const listAgentInfoHandler = (deps: RouteDeps): AppRouteHandler<typeof listAgentInfoRoute> => {
  return (c) => {
    const agents = deps.agentRegistry.list();
    const result = agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      availability: agent.checkAvailability(),
    }));
    return c.json(result, 200);
  };
};
