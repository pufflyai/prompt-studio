import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { agentConfigResponseSchema, setupAgentBodySchema } from "../dto";

export const setupAgentRoute = createRoute({
  method: "post",
  path: "/agents",
  description: "Add or configure an agent.",
  tags: ["Agents"],
  request: {
    body: {
      content: { "application/json": { schema: setupAgentBodySchema } },
    },
  },
  responses: {
    201: {
      description: "Agent configured.",
      content: { "application/json": { schema: agentConfigResponseSchema } },
    },
  },
});

export const setupAgentHandler = (deps: RouteDeps): AppRouteHandler<typeof setupAgentRoute> => {
  return async (c) => {
    const { agent_id } = c.req.valid("json");
    const agent = await deps.agentConfigsService.upsert(agent_id);
    deps.eventBus.emit("agent_configs", "set", agent);
    return c.json(agent, 201);
  };
};
