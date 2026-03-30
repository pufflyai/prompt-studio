import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { agentConfigResponseSchema, notFoundResponseSchema, updateAgentBodySchema } from "../dto";

export const updateAgentRoute = createRoute({
  method: "patch",
  path: "/agents/{agentId}",
  description: "Update an agent configuration.",
  tags: ["Agents"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        agentId: z.string().openapi({ description: "Agent identifier" }),
      })
      .strict(),
    body: {
      content: { "application/json": { schema: updateAgentBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Agent updated.",
      content: { "application/json": { schema: agentConfigResponseSchema } },
    },
    404: {
      description: "Agent not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const updateAgentHandler = (deps: RouteDeps): AppRouteHandler<typeof updateAgentRoute> => {
  return async (c) => {
    const { agentId } = c.req.valid("param");
    const body = c.req.valid("json");

    const result = await deps.agentConfigService.update(agentId, body);
    if (!result) {
      return c.json({ error: "Agent not found" }, 404);
    }

    for (const cleared of result.clearedDefaults) {
      deps.eventBus.emit("agent_configs", "set", cleared);
    }
    deps.eventBus.emit("agent_configs", "set", result.updated);
    return c.json(result.updated, 200);
  };
};
