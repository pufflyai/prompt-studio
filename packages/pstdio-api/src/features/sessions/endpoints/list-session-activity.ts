import { createRoute, z } from "@hono/zod-openapi";
import { listSessionActivityInputSchema, listSessionActivityResponseSchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import { listActivityEvents } from "../../activity/activity-events";
import type { RouteDeps } from "../../deps";

export const listSessionActivityRoute = createRoute({
  method: "get",
  path: "/sessions/{id}/activity",
  description: "List activity events for a session.",
  tags: ["Sessions"],
  request: {
    params: z.object({ id: z.string().openapi({ description: "Session ID" }) }).strict(),
    query: listSessionActivityInputSchema.strict(),
  },
  responses: {
    200: {
      description: "Session activity events.",
      content: { "application/json": { schema: listSessionActivityResponseSchema } },
    },
    404: {
      description: "Session not found.",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
  },
});

export const listSessionActivityHandler = (deps: RouteDeps): AppRouteHandler<typeof listSessionActivityRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const query = c.req.valid("query");

    const session = await deps.sessionService.get(id);
    if (!session) {
      return c.json({ error: `Session not found: ${id}` }, 404);
    }

    if (!session.project_id) {
      return c.json({ events: [], next_cursor: null }, 200);
    }

    const listed = await listActivityEvents(deps, {
      projectId: session.project_id,
      resourceType: "session",
      resourceId: session.id,
      eventType: query.event_type,
      from: query.from,
      to: query.to,
      cursor: query.cursor,
      limit: query.limit,
    });

    return c.json(listed, 200);
  };
};
