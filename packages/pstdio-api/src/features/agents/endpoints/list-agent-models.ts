import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { AgentsRouteDeps } from "../deps";
import { agentModelsListResponseSchema, agentProjectQuerySchema } from "../dto";

const agentIdParamSchema = z
  .object({
    agentId: z
      .string()
      .min(1)
      .openapi({ description: "Harness id (e.g. pstdio.harness-claude-code.harness.claude-code)" }),
  })
  .strict();

export const listAgentModelsRoute = createRoute({
  deprecated: true,
  method: "get",
  path: "/agents/{agentId}/models",
  description: "List available models for a specific agent.",
  tags: ["Agents"],
  request: {
    query: agentProjectQuerySchema,
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

export const listAgentModelsHandler = (deps: AgentsRouteDeps): AppRouteHandler<typeof listAgentModelsRoute> => {
  return async (c) => {
    const { agentId } = c.req.valid("param");
    const { projectId, project } = c.req.valid("query");
    const harness = await deps.harnessRegistry.get(agentId, { projectId: projectId ?? project });

    if (!harness) {
      return c.json({ error: `Agent not found: ${agentId}` }, 404);
    }

    return c.json(await harness.listModels({ projectId: projectId ?? project }), 200);
  };
};
