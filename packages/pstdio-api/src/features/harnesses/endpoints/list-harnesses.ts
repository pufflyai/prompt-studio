import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { harnessConfigListResponseSchema } from "../dto";
import { toHarnessConfig } from "../harness-ids";

export const listHarnessesRoute = createRoute({
  method: "get",
  path: "/harnesses",
  description: "List configured harnesses.",
  tags: ["Harnesses"],
  request: {
    query: z.object({}).strict(),
  },
  responses: {
    200: {
      description: "List of configured harnesses.",
      content: { "application/json": { schema: harnessConfigListResponseSchema } },
    },
  },
});

export const listHarnessesHandler = (deps: RouteDeps): AppRouteHandler<typeof listHarnessesRoute> => {
  return async (c) => {
    const harnesses = (await deps.agentConfigService.list()).map(toHarnessConfig);
    return c.json(harnesses, 200);
  };
};
