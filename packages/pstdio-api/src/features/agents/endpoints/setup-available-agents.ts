import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { AgentsRouteDeps } from "../deps";
import { agentConfigListResponseSchema } from "../dto";
import { setupInstalledAgents } from "../setup-installed-agents";

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

export const setupAvailableAgentsHandler = (
  deps: AgentsRouteDeps,
): AppRouteHandler<typeof setupAvailableAgentsRoute> => {
  return async (c) => {
    const { default_agent_id } = c.req.valid("json");
    const updated = await setupInstalledAgents(deps, default_agent_id);
    return c.json(updated, 201);
  };
};
