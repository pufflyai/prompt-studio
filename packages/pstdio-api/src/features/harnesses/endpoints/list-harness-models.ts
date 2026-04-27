import { createRoute, z } from "@hono/zod-openapi";
import type { AgentId } from "pstdio-agents";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { harnessModelsListResponseSchema, notFoundResponseSchema } from "../dto";
import { toAgentId, toHarnessId } from "../harness-ids";

const harnessIdParamSchema = z
  .object({
    harnessId: z.string().min(1).openapi({ description: "Harness provider identifier" }),
  })
  .strict();

export const listHarnessModelsRoute = createRoute({
  method: "get",
  path: "/harnesses/{harnessId}/models",
  description: "List available models for a specific harness provider.",
  tags: ["Harnesses"],
  request: {
    query: z.object({}).strict(),
    params: harnessIdParamSchema,
  },
  responses: {
    200: {
      description: "List of available models.",
      content: { "application/json": { schema: harnessModelsListResponseSchema } },
    },
    404: {
      description: "Harness not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const listHarnessModelsHandler = (deps: RouteDeps): AppRouteHandler<typeof listHarnessModelsRoute> => {
  return (c) => {
    const { harnessId } = c.req.valid("param");
    const agentId = toAgentId(harnessId);
    const agent = deps.agentRegistry.get(agentId as AgentId);

    if (!agent) {
      return c.json({ error: `Harness not found: ${toHarnessId(agentId)}` }, 404);
    }

    return c.json(agent.listModels(), 200);
  };
};
