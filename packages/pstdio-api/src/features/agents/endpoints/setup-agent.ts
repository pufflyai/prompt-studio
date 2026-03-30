import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { agentConfigResponseSchema, setupAgentBodySchema } from "../dto";

export const setupAgentRoute = createRoute({
  method: "post",
  path: "/agents",
  description: "Add or configure an agent.",
  tags: ["Agents"],
  request: {
    query: z.object({}).strict(),
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
    const { agent_id, binary } = c.req.valid("json");
    const createdOrExisting = await deps.agentConfigService.upsert(agent_id);
    if (!binary) {
      deps.eventBus.emit("agent_configs", "set", createdOrExisting);
      return c.json(createdOrExisting, 201);
    }

    const result = await deps.agentConfigService.update(agent_id, { binary });
    const agent = result?.updated ?? createdOrExisting;
    deps.eventBus.emit("agent_configs", "set", agent);
    return c.json(agent, 201);
  };
};
