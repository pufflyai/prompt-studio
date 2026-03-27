import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { agentConfigListResponseSchema } from "../dto";

export const setupAvailableAgentsBodySchema = z
  .object({
    default_agent_id: z.string().min(1).openapi({ description: "Agent to mark as the default" }),
  })
  .strict();

export const setupAvailableAgentsRoute = createRoute({
  method: "post",
  path: "/agents/setup-available",
  description: "Set up all available agents. Marks the specified agent as the default.",
  tags: ["Agents"],
  request: {
    query: z.object({}).strict(),
    body: {
      content: { "application/json": { schema: setupAvailableAgentsBodySchema } },
    },
  },
  responses: {
    201: {
      description: "All available agents configured.",
      content: { "application/json": { schema: agentConfigListResponseSchema } },
    },
  },
});

export const setupAvailableAgentsHandler = (deps: RouteDeps): AppRouteHandler<typeof setupAvailableAgentsRoute> => {
  return async (c) => {
    const { default_agent_id } = c.req.valid("json");
    const agents = deps.agentRegistry.list();

    const configs = [];
    for (const agent of agents) {
      const config = await deps.agentConfigsService.upsert(agent.id);
      configs.push(config);
    }

    await deps.agentConfigsService.update(default_agent_id, { is_default: true });

    const updated = await deps.agentConfigsService.list();
    for (const config of updated) {
      deps.eventBus.emit("agent_configs", "set", config);
    }

    return c.json(updated, 201);
  };
};
