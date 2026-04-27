import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema, sessionResponse } from "../dto";

export const stopHarnessSessionRoute = createRoute({
  method: "post",
  path: "/harnesses/sessions/{id}/stop",
  description: "Stop a running harness-backed session.",
  tags: ["Harnesses"],
  request: {
    params: z.object({ id: z.string() }).strict(),
  },
  responses: {
    200: {
      description: "Session stopped.",
      content: { "application/json": { schema: sessionResponse } },
    },
    404: {
      description: "Session not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const stopHarnessSessionHandler = (deps: RouteDeps): AppRouteHandler<typeof stopHarnessSessionRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const session = await deps.sessionService.cancel(id);
    if (!session) {
      return c.json({ error: `Session not found: ${id}` }, 404);
    }

    return c.json(session, 200);
  };
};
