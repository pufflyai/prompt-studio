import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { NotificationsRouteDeps } from "../deps";
import {
  countNotificationsQueryParamsSchema,
  invalidFilterResponseSchema,
  NotificationFilterError,
  notificationCountResponseDtoSchema,
  parsePriorityFilter,
  parseStatusFilter,
} from "../dto";

export const countNotificationsRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/notifications/count",
  description: "Count notifications for a project (badge support).",
  tags: ["Notifications"],
  request: {
    params: z.object({ projectId: z.string() }).strict(),
    query: countNotificationsQueryParamsSchema,
  },
  responses: {
    200: {
      description: "Count of matching notifications.",
      content: { "application/json": { schema: notificationCountResponseDtoSchema } },
    },
    400: {
      description: "Invalid notification filter.",
      content: { "application/json": { schema: invalidFilterResponseSchema } },
    },
  },
});

export const countNotificationsHandler = (
  deps: NotificationsRouteDeps,
): AppRouteHandler<typeof countNotificationsRoute> => {
  return async (c) => {
    const { projectId } = c.req.valid("param");
    const query = c.req.valid("query");
    try {
      const count = await deps.notificationsService.count({
        projectId,
        status: parseStatusFilter(query.status) ?? ["open"],
        priority: parsePriorityFilter(query.priority),
        sourceExtensionId: query.sourceExtensionId,
      });
      return c.json({ count }, 200);
    } catch (error) {
      if (error instanceof NotificationFilterError) return c.json({ error: error.message }, 400);
      throw error;
    }
  };
};
