import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import { toAgentInfo } from "../agent-info";
import type { AgentsRouteDeps } from "../deps";
import { agentInfoListResponseSchema, agentProjectQuerySchema } from "../dto";

export const listAgentInfoRoute = createRoute({
  deprecated: true,
  method: "get",
  path: "/agents/info",
  description: "List all known agents with availability status.",
  tags: ["Agents"],

  request: {
    query: agentProjectQuerySchema,
  },
  responses: {
    200: {
      description: "List of known agents with availability.",
      content: { "application/json": { schema: agentInfoListResponseSchema } },
    },
  },
});

export const listAgentInfoHandler = (deps: AgentsRouteDeps): AppRouteHandler<typeof listAgentInfoRoute> => {
  return async (c) => {
    const query = c.req.valid("query");
    const projectId = query.projectId ?? query.project;
    const harnesses = await deps.harnessRegistry.list({ projectId });
    const result = await Promise.all(harnesses.map((harness) => toAgentInfo(harness, projectId)));
    return c.json(result, 200);
  };
};
