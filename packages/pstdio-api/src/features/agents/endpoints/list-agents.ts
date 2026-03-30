import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { agentConfigListResponseSchema } from "../dto";

export const listAgentsRoute = createRoute({
  method: "get",
  path: "/agents",
  description: "List all configured agents.",
  tags: ["Agents"],

  request: {
    query: z.object({}).strict(),
  },
  responses: {
    200: {
      description: "List of configured agents.",
      content: { "application/json": { schema: agentConfigListResponseSchema } },
    },
  },
});

export const listAgentsHandler = (deps: RouteDeps): AppRouteHandler<typeof listAgentsRoute> => {
  return async (c) => {
    const agents = await deps.agentConfigService.list();
    return c.json(agents, 200);
  };
};
