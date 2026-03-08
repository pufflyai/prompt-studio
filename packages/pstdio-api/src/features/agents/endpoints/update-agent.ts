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

    const updated = await deps.agentConfigsService.update(agentId, body);
    if (!updated) {
      return c.json({ error: "Agent not found" }, 404);
    }

    deps.eventBus.emit("agent_configs", "set", updated);
    return c.json(updated, 200);
  };
};
