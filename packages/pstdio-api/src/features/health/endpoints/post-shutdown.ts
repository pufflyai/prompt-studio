import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import { healthResponseSchema } from "../dto";

export const postShutdownRoute = createRoute({
  method: "post",
  path: "/shutdown",
  description: "Gracefully shut down the API server.",
  tags: ["Health"],
  responses: {
    200: {
      description: "Server is shutting down.",
      content: {
        "application/json": {
          schema: healthResponseSchema,
        },
      },
    },
  },
});

type ShutdownDeps = {
  exit: () => void;
};

const defaultDeps: ShutdownDeps = {
  exit: () => process.exit(0),
};

export const postShutdownHandler = (deps: ShutdownDeps = defaultDeps): AppRouteHandler<typeof postShutdownRoute> => {
  return async (c) => {
    setTimeout(deps.exit, 50);
    return c.json({ ok: true }, 200);
  };
};
