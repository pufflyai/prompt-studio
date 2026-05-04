import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { HealthRouteDeps } from "../deps";
import { readyResponseSchema } from "../dto";

export const getReadyzRoute = createRoute({
  method: "get",
  path: "/readyz",
  description: "Readiness probe.",
  tags: ["Health"],

  request: {
    query: z.object({}).strict(),
  },
  responses: {
    200: {
      description: "Service is ready.",
      content: {
        "application/json": {
          schema: readyResponseSchema,
        },
      },
    },
    503: {
      description: "Service is not ready.",
      content: {
        "application/json": {
          schema: readyResponseSchema,
        },
      },
    },
  },
});

export const getReadyzHandler = (deps: HealthRouteDeps): AppRouteHandler<typeof getReadyzRoute> => {
  return async (c) => {
    const { database, storage } = deps.readiness;
    const ok = database && storage;

    return c.json(
      {
        checks: {
          database,
          storage,
        },
        ok,
      },
      ok ? 200 : 503,
    );
  };
};
