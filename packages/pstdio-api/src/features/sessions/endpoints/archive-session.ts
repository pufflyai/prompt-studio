import { createRoute, z } from "@hono/zod-openapi";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema, sessionResponseSchema } from "../dto";

export const archiveSessionRoute = createRoute({
  method: "post",
  path: "/sessions/{id}/archive",
  description: "Archive a session.",
  tags: ["Sessions"],
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Session ID" }),
    }),
  },
  responses: {
    200: {
      description: "Session archived.",
      content: { "application/json": { schema: sessionResponseSchema } },
    },
    404: {
      description: "Session not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
    409: {
      description: "Session already archived.",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
  },
});

export const archiveSessionHandler = (deps: RouteDeps) => {
  return async (c: any) => {
    const { id } = c.req.valid("param");

    const session = await deps.sessionsService.get(id);
    if (!session) {
      return c.json({ error: `Session not found: ${id}` }, 404);
    }

    if (session.archived) {
      return c.json({ error: `Session already archived: ${id}` }, 409);
    }

    const updated = await deps.sessionsService.archive(id);
    deps.eventBus.emit("sessions", "set", updated);
    return c.json(updated, 200);
  };
};
