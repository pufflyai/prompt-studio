import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import { healthResponseSchema } from "../dto";

export const getHealthzRoute = createRoute({
  method: "get",
  path: "/healthz",
  description: "Liveness probe.",
  tags: ["Health"],

  request: {
    query: z.object({}).strict(),
  },
  responses: {
    200: {
      description: "Service is alive.",
      content: {
        "application/json": {
          schema: healthResponseSchema,
        },
      },
    },
  },
});

export const getHealthzHandler: AppRouteHandler<typeof getHealthzRoute> = async (c) => {
  return c.json(
    {
      ok: true,
    },
    200,
  );
};
