import { createRoute, z } from "@hono/zod-openapi";
import type { AgentId } from "pstdio-agents";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { agentModelsListResponseSchema } from "../dto";

const agentIdParamSchema = z
  .object({
    agentId: z.string().min(1).openapi({ description: "Agent identifier (e.g. claude-code, opencode)" }),
  })
  .strict();

export const listAgentModelsRoute = createRoute({
  method: "get",
  path: "/agents/{agentId}/models",
  description: "List available models for a specific agent.",
  tags: ["Agents"],
  request: {
    query: z.object({}).strict(),
    params: agentIdParamSchema,
  },
  responses: {
    200: {
      description: "List of available models.",
      content: { "application/json": { schema: agentModelsListResponseSchema } },
    },
    404: {
      description: "Agent not found.",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
  },
});

export const listAgentModelsHandler = (deps: RouteDeps): AppRouteHandler<typeof listAgentModelsRoute> => {
  return (c) => {
    const { agentId } = c.req.valid("param");
    const agent = deps.agentRegistry.get(agentId as AgentId);

    if (!agent) {
      return c.json({ error: `Agent not found: ${agentId}` }, 404);
    }

    return c.json(agent.listModels(), 200);
  };
};
