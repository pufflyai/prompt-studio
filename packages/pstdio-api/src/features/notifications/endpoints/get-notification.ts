import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { NotificationsRouteDeps } from "../deps";
import { errorResponseSchema, notificationParamsSchema, notificationResponseSchema } from "../dto";
import { asNotificationHandlerContext } from "../handler-context";

export const getNotificationRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/notifications/{id}",
  tags: ["Notifications"],
  request: { params: notificationParamsSchema },
  responses: {
    200: {
      description: "Notification.",
      content: { "application/json": { schema: notificationResponseSchema } },
    },
    404: {
      description: "Notification not found.",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
});

export const getNotificationHandler = (deps: NotificationsRouteDeps): AppRouteHandler<typeof getNotificationRoute> => {
  const handler = async (c: never) => {
    const context = asNotificationHandlerContext(c);
    const { projectId, id } = context.req.valid("param") as { projectId: string; id: string };
    const notification = await deps.notificationService.get(projectId, id);
    if (!notification) return context.json({ error: "Notification not found." }, 404);
    return context.json(notification, 200);
  };
  return handler as unknown as AppRouteHandler<typeof getNotificationRoute>;
};
