import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { NotificationsRouteDeps } from "../deps";
import {
  invalidFilterResponseSchema,
  listNotificationsQueryParamsSchema,
  listNotificationsResponseDtoSchema,
  NotificationFilterError,
  parsePriorityFilter,
  parseStatusFilter,
} from "../dto";
import { toNotification } from "../notifications-service";

export const listNotificationsRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/notifications",
  description: "List notifications for a project. Defaults to status=open.",
  tags: ["Notifications"],
  request: {
    params: z.object({ projectId: z.string() }).strict(),
    query: listNotificationsQueryParamsSchema,
  },
  responses: {
    200: {
      description: "List of notifications.",
      content: { "application/json": { schema: listNotificationsResponseDtoSchema } },
    },
    400: {
      description: "Invalid notification filter.",
      content: { "application/json": { schema: invalidFilterResponseSchema } },
    },
  },
});

export const listNotificationsHandler = (
  deps: NotificationsRouteDeps,
): AppRouteHandler<typeof listNotificationsRoute> => {
  return async (c) => {
    const { projectId } = c.req.valid("param");
    const query = c.req.valid("query");

    try {
      const result = await deps.notificationsService.list({
        projectId,
        status: parseStatusFilter(query.status) ?? ["open"],
        priority: parsePriorityFilter(query.priority),
        sourceExtensionId: query.sourceExtensionId,
        resourceType: query.resourceType,
        resourceId: query.resourceId,
        cursor: query.cursor,
        limit: query.limit,
      });
      return c.json({ items: result.items.map(toNotification), nextCursor: result.nextCursor }, 200);
    } catch (error) {
      if (error instanceof NotificationFilterError) return c.json({ error: error.message }, 400);
      throw error;
    }
  };
};
