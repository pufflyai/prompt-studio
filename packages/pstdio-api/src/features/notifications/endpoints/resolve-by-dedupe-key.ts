import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { NotificationsRouteDeps } from "../deps";
import { notificationResponseSchema, resolveByDedupeKeyBodySchema } from "../dto";
import { resolveByDedupeKey, toNotification } from "../notifications-service";

export const resolveByDedupeKeyRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/notifications/resolve-by-dedupe-key",
  description: "Idempotent resolve of the live notification matching dedupeKey. Returns null if none.",
  tags: ["Notifications"],
  request: {
    params: z.object({ projectId: z.string() }).strict(),
    body: { content: { "application/json": { schema: resolveByDedupeKeyBodySchema } } },
  },
  responses: {
    200: {
      description: "Resolved notification, or null when no matching live row.",
      content: { "application/json": { schema: notificationResponseSchema.nullable() } },
    },
  },
});

export const resolveByDedupeKeyHandler = (
  deps: NotificationsRouteDeps,
): AppRouteHandler<typeof resolveByDedupeKeyRoute> => {
  return async (c) => {
    const { projectId } = c.req.valid("param");
    const body = c.req.valid("json");
    const row = await resolveByDedupeKey(deps, {
      projectId,
      dedupeKey: body.dedupeKey,
      status: body.status,
    });
    return c.json(row ? toNotification(row) : null, 200);
  };
};
