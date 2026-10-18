import { createRoute, z } from "@hono/zod-openapi";
import { agentDetailsSchema, agentModelSchema, pageQuerySchema } from "pstdio-api-contracts";
import { catalogPage } from "../../../services/catalog-page";
import type { AppRouteHandler } from "../../../types";
import { toAgentInfo } from "../agent-info";
import type { AgentsRouteDeps } from "../deps";
import { agentProjectQuerySchema } from "../dto";

const query = agentProjectQuerySchema.safeExtend(pageQuerySchema.shape);
export const queryAgentsRoute = createRoute({
  method: "get",
  path: "/agents/query",
  tags: ["Agents"],
  request: { query },
  responses: {
    200: {
      description: "One agent page",
      content: {
        "application/json": {
          schema: z.object({ items: z.array(agentDetailsSchema), nextCursor: z.string().nullable() }),
        },
      },
    },
  },
});
export const queryModelsRoute = createRoute({
  method: "get",
  path: "/agents/{agentId}/models/query",
  tags: ["Agents"],
  request: { query, params: z.object({ agentId: z.string() }) },
  responses: {
    200: {
      description: "One model page",
      content: {
        "application/json": {
          schema: z.object({ items: z.array(agentModelSchema), nextCursor: z.string().nullable() }),
        },
      },
    },
    404: {
      description: "Agent unavailable",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
  },
});
export const queryAgentsHandler = (deps: AgentsRouteDeps) => {
  const handler: AppRouteHandler<typeof queryAgentsRoute> = async (c) => {
    const input = c.req.valid("query");
    const projectId = input.projectId ?? input.project;
    const page = catalogPage(await deps.harnessRegistry.list({ projectId }), `agents:${projectId ?? ""}`, input);
    return c.json(
      { ...page, items: await Promise.all(page.items.map((harness) => toAgentInfo(harness, projectId))) },
      200,
    );
  };
  return handler;
};
export const queryModelsHandler = (deps: AgentsRouteDeps) => {
  const handler: AppRouteHandler<typeof queryModelsRoute> = async (c) => {
    const input = c.req.valid("query");
    const projectId = input.projectId ?? input.project;
    const { agentId } = c.req.valid("param");
    const harness = await deps.harnessRegistry.get(agentId, { projectId });
    if (!harness) return c.json({ error: `Agent not found: ${agentId}` }, 404);
    return c.json(
      catalogPage(await harness.listModels({ projectId }), `models:${projectId ?? ""}:${agentId}`, input),
      200,
    );
  };
  return handler;
};
