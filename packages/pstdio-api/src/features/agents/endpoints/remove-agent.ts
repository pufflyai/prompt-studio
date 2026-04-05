import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema } from "../dto";

export const removeAgentRoute = createRoute({
  method: "delete",
  path: "/agents/{agentId}",
  description: "Remove a configured agent.",
  tags: ["Agents"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        agentId: z.string().openapi({ description: "Agent identifier" }),
      })
      .strict(),
  },
  responses: {
    204: {
      description: "Agent removed.",
    },
    404: {
      description: "Agent not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const removeAgentHandler = (deps: RouteDeps): AppRouteHandler<typeof removeAgentRoute> => {
  return async (c) => {
    const { agentId } = c.req.valid("param");
    const config = await deps.agentConfigService.get(agentId);
    const removed = await deps.agentConfigService.remove(agentId);
    if (!removed || !config) {
      return c.json({ error: `Agent not found: ${agentId}` }, 404);
    }
    deps.eventBus.emit("agent_configs", "delete", { id: config.id });
    return c.body(null, 204);
  };
};
