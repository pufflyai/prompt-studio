import { createRoute } from "@hono/zod-openapi";
import { toAvailabilityInfo } from "../../harnesses/harness-registry-service";
import type { AppRouteHandler } from "../../../types";
import type { AgentsRouteDeps } from "../deps";
import { availabilitySchema, checkAgentAvailabilityQuerySchema } from "../dto";

export const checkAgentAvailabilityRoute = createRoute({
  method: "get",
  path: "/agents/availability",
  description: "Check whether a coding agent is installed and available.",
  tags: ["Agents"],
  request: {
    query: checkAgentAvailabilityQuerySchema,
  },
  responses: {
    200: {
      description: "Availability status.",
      content: {
        "application/json": {
          schema: availabilitySchema,
        },
      },
    },
  },
});

export const checkAgentAvailabilityHandler = (
  deps: AgentsRouteDeps,
): AppRouteHandler<typeof checkAgentAvailabilityRoute> => {
  return async (c) => {
    const { agent: agentId } = c.req.valid("query");
    const harness = await deps.harnessRegistry.get(agentId);
    const availability = harness ? toAvailabilityInfo(await harness.detect()) : { type: "NOT_FOUND" as const };

    return c.json(availability, 200);
  };
};
