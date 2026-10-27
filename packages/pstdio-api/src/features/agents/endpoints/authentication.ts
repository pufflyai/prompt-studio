import { createRoute, z } from "@hono/zod-openapi";
import { harnessAuthenticationSchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import type { AgentsRouteDeps } from "../deps";
import { agentProjectQuerySchema } from "../dto";

export const agentAuthenticationRoute = createRoute({
  method: "get",
  path: "/agents/{agentId}/authentication",
  tags: ["Agents"],
  request: {
    params: z.object({ agentId: z.string() }),
    query: agentProjectQuerySchema.safeExtend({ model: z.string().optional() }),
  },
  responses: {
    200: {
      description: "Account state for the selected model provider. No credentials are returned.",
      content: { "application/json": { schema: harnessAuthenticationSchema.nullable() } },
    },
    404: {
      description: "Harness unavailable",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
  },
});
export const agentAuthenticationHandler =
  (deps: AgentsRouteDeps): AppRouteHandler<typeof agentAuthenticationRoute> =>
  async (c) => {
    const { agentId } = c.req.valid("param");
    const { project, projectId, model } = c.req.valid("query");
    const options = { projectId: projectId ?? project, model };
    const harness = await deps.harnessRegistry.get(agentId, options);
    if (!harness || !(await harness.detect(options)).available) return c.json({ error: "Harness unavailable" }, 404);
    return c.json((await harness.getAuthentication?.(options)) ?? null, 200);
  };
