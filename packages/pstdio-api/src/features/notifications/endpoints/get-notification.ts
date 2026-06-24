import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { NotificationsRouteDeps } from "../deps";
import { notFoundResponseSchema, notificationResponseSchema } from "../dto";
import { toNotification } from "../notifications-service";

export const getNotificationRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/notifications/{id}",
  description: "Get a single notification.",
  tags: ["Notifications"],
  request: {
    params: z.object({ projectId: z.string(), id: z.string() }).strict(),
  },
  responses: {
    200: {
      description: "Notification.",
      content: { "application/json": { schema: notificationResponseSchema } },
    },
    404: {
      description: "Notification not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const getNotificationHandler = (deps: NotificationsRouteDeps): AppRouteHandler<typeof getNotificationRoute> => {
  return async (c) => {
    const { projectId, id } = c.req.valid("param");
    const row = await deps.notificationsService.findById(projectId, id);
    if (!row) return c.json({ error: "Notification not found" }, 404);
    return c.json(toNotification(row), 200);
  };
};
