import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema, sessionResponseSchema } from "../dto";

export const updateSessionStatusRoute = createRoute({
  method: "patch",
  path: "/sessions/{id}/status",
  description: "Update session status.",
  tags: ["Sessions"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        id: z.string().openapi({ description: "Session ID" }),
      })
      .strict(),
    body: {
      content: {
        "application/json": {
          schema: z
            .object({
              status: z.enum(["in_progress", "awaiting_input", "completed", "failed", "cancelled"]),
            })
            .strict(),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Session status updated.",
      content: { "application/json": { schema: sessionResponseSchema } },
    },
    404: {
      description: "Session not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const updateSessionStatusHandler = (deps: RouteDeps): AppRouteHandler<typeof updateSessionStatusRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const { status } = c.req.valid("json");

    const updated = await deps.sessionService.transitionStatus(id, status);
    if (!updated) {
      return c.json({ error: `Session not found: ${id}` }, 404);
    }

    return c.json(updated, 200);
  };
};
