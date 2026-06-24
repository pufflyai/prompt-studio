import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { NotificationsRouteDeps } from "../deps";
import { notFoundResponseSchema, notificationResponseSchema, updateNotificationBodySchema } from "../dto";
import { toNotification, transitionStatus } from "../notifications-service";

export const updateNotificationRoute = createRoute({
  method: "patch",
  path: "/projects/{projectId}/notifications/{id}",
  description: "Update notification status, priority, snooze deadline, or metadata.",
  tags: ["Notifications"],
  request: {
    params: z.object({ projectId: z.string(), id: z.string() }).strict(),
    body: { content: { "application/json": { schema: updateNotificationBodySchema } } },
  },
  responses: {
    200: {
      description: "Notification updated.",
      content: { "application/json": { schema: notificationResponseSchema } },
    },
    404: {
      description: "Notification not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const updateNotificationHandler = (
  deps: NotificationsRouteDeps,
): AppRouteHandler<typeof updateNotificationRoute> => {
  return async (c) => {
    const { projectId, id } = c.req.valid("param");
    const body = c.req.valid("json");

    if (body.status) {
      const updated = await transitionStatus(deps, {
        projectId,
        id,
        status: body.status,
        snoozedUntil: body.snoozedUntil ?? undefined,
      });
      if (!updated) return c.json({ error: "Notification not found" }, 404);
      return c.json(toNotification(updated), 200);
    }

    const updated = await deps.notificationsService.update(projectId, id, {
      priority: body.priority,
      snoozedUntil: body.snoozedUntil ?? undefined,
      metadata: body.metadata,
    });
    if (!updated) return c.json({ error: "Notification not found" }, 404);
    deps.eventBus.emit("notifications", "set", toNotification(updated));
    return c.json(toNotification(updated), 200);
  };
};
