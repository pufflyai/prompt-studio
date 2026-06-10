import { createRoute, z } from "@hono/zod-openapi";
import { resolveHarnessName, toAvailabilityInfo } from "../../harnesses/harness-registry-service";
import type { AppRouteHandler } from "../../../types";
import type { AgentsRouteDeps } from "../deps";
import { agentInfoListResponseSchema } from "../dto";

export const listAgentInfoRoute = createRoute({
  method: "get",
  path: "/agents/info",
  description: "List all known agents with availability status.",
  tags: ["Agents"],

  request: {
    query: z.object({}).strict(),
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
    const harnesses = await deps.harnessRegistry.list();
    const result = await Promise.all(
      harnesses.map(async (harness) => ({
        id: harness.id,
        name: resolveHarnessName(harness),
        availability: toAvailabilityInfo(await harness.detect()),
      })),
    );
    return c.json(result, 200);
  };
};
