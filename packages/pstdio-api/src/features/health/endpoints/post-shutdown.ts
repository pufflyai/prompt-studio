import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import { healthResponseSchema } from "../dto";

export const postShutdownRoute = createRoute({
  method: "post",
  path: "/shutdown",
  description: "Gracefully shut down the API server.",
  tags: ["Health"],

  request: {
    query: z.object({}).strict(),
  },
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
  closeDb: () => Promise<void>;
  exit?: () => void;
};

export const postShutdownHandler = (deps: ShutdownDeps): AppRouteHandler<typeof postShutdownRoute> => {
  const exit = deps.exit ?? (() => process.exit(0));

  return async (c) => {
    const timer = setTimeout(async () => {
      await deps.closeDb();
      exit();
    }, 50);
    timer.unref();
    return c.json({ ok: true }, 200);
  };
};
