import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import { buildDiff, emitActivityEvent } from "../../activity/activity-events";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema, sessionResponseSchema } from "../dto";

export const archiveSessionRoute = createRoute({
  method: "post",
  path: "/sessions/{id}/archive",
  description: "Archive a session.",
  tags: ["Sessions"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        id: z.string().openapi({ description: "Session ID" }),
      })
      .strict(),
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

export const archiveSessionHandler = (deps: RouteDeps): AppRouteHandler<typeof archiveSessionRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");

    const session = await deps.sessionService.get(id);
    if (!session) {
      return c.json({ error: `Session not found: ${id}` }, 404);
    }

    if (session.archived) {
      return c.json({ error: `Session already archived: ${id}` }, 409);
    }

    const updated = await deps.sessionService.archive(id);
    if (!updated) {
      return c.json({ error: `Session not found: ${id}` }, 404);
    }

    if (updated.project_id) {
      await emitActivityEvent(deps, {
        projectId: updated.project_id,
        resourceType: "session",
        resourceId: updated.id,
        eventType: "session_archived",
        summary: `Archived session ${updated.title}`,
        payload: {
          archived: buildDiff(false, true),
        },
      });
    }

    return c.json(updated, 200);
  };
};
