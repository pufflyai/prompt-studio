import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { harnessInfoListResponseSchema } from "../dto";
import { toHarnessId } from "../harness-ids";

export const listHarnessInfoRoute = createRoute({
  method: "get",
  path: "/harnesses/info",
  description: "List known harness providers with availability status.",
  tags: ["Harnesses"],
  request: {
    query: z.object({}).strict(),
  },
  responses: {
    200: {
      description: "List of known harness providers with availability.",
      content: { "application/json": { schema: harnessInfoListResponseSchema } },
    },
  },
});

export const listHarnessInfoHandler = (deps: RouteDeps): AppRouteHandler<typeof listHarnessInfoRoute> => {
  return (c) => {
    const harnesses = deps.agentRegistry.list().map((agent) => {
      const id = toHarnessId(agent.id);
      return {
        id,
        name: agent.name,
        extension_id: id,
        availability: agent.checkAvailability(),
      };
    });

    return c.json(harnesses, 200);
  };
};
