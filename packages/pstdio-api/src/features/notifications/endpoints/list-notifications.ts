import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { NotificationsRouteDeps } from "../deps";
import {
  countNotificationsQuerySchema,
  countNotificationsResponseSchema,
  listNotificationsQuerySchema,
  listNotificationsResponseSchema,
  projectParamsSchema,
} from "../dto";
import { asNotificationHandlerContext } from "../handler-context";
import { parseListNotificationsQuery } from "../query";

export const listNotificationsRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/notifications",
  tags: ["Notifications"],
  request: {
    params: projectParamsSchema,
    query: listNotificationsQuerySchema,
  },
  responses: {
    200: {
      description: "Notifications for the project.",
      content: { "application/json": { schema: listNotificationsResponseSchema } },
    },
  },
});

export const countNotificationsRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/notifications/count",
  tags: ["Notifications"],
  request: {
    params: projectParamsSchema,
    query: countNotificationsQuerySchema,
  },
  responses: {
    200: {
      description: "Notification count for the project.",
      content: { "application/json": { schema: countNotificationsResponseSchema } },
    },
  },
});

export const listNotificationsHandler = (
  deps: NotificationsRouteDeps,
): AppRouteHandler<typeof listNotificationsRoute> => {
  const handler = async (c: never) => {
    const context = asNotificationHandlerContext(c);
    const { projectId } = context.req.valid("param") as { projectId: string };
    const query = parseListNotificationsQuery(
      context.req.valid("query") as Parameters<typeof parseListNotificationsQuery>[0],
    );
    return context.json(await deps.notificationService.list(projectId, query), 200);
  };
  return handler as unknown as AppRouteHandler<typeof listNotificationsRoute>;
};

export const countNotificationsHandler = (
  deps: NotificationsRouteDeps,
): AppRouteHandler<typeof countNotificationsRoute> => {
  const handler = async (c: never) => {
    const context = asNotificationHandlerContext(c);
    const { projectId } = context.req.valid("param") as { projectId: string };
    const query = parseListNotificationsQuery(
      context.req.valid("query") as Parameters<typeof parseListNotificationsQuery>[0],
    );
    return context.json(await deps.notificationService.count(projectId, query), 200);
  };
  return handler as unknown as AppRouteHandler<typeof countNotificationsRoute>;
};
