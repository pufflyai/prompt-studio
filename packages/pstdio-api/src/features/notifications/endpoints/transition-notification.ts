import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { NotificationsRouteDeps } from "../deps";
import {
  errorResponseSchema,
  notificationParamsSchema,
  notificationResponseSchema,
  projectParamsSchema,
  resolveByDedupeKeyBodySchema,
  resolveByDedupeKeyResponseSchema,
  snoozeNotificationBodySchema,
} from "../dto";
import { asNotificationHandlerContext } from "../handler-context";

const transitionResponses = {
  200: {
    description: "Notification updated.",
    content: { "application/json": { schema: notificationResponseSchema } },
  },
  404: {
    description: "Notification not found.",
    content: { "application/json": { schema: errorResponseSchema } },
  },
} as const;

export const markNotificationReadRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/notifications/{id}/read",
  tags: ["Notifications"],
  request: { params: notificationParamsSchema },
  responses: transitionResponses,
});

export const markNotificationDoneRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/notifications/{id}/done",
  tags: ["Notifications"],
  request: { params: notificationParamsSchema },
  responses: transitionResponses,
});

export const dismissNotificationRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/notifications/{id}/dismiss",
  tags: ["Notifications"],
  request: { params: notificationParamsSchema },
  responses: transitionResponses,
});

export const snoozeNotificationRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/notifications/{id}/snooze",
  tags: ["Notifications"],
  request: {
    params: notificationParamsSchema,
    body: { content: { "application/json": { schema: snoozeNotificationBodySchema } } },
  },
  responses: transitionResponses,
});

export const resolveNotificationByDedupeKeyRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/notifications/resolve-by-dedupe-key",
  tags: ["Notifications"],
  request: {
    params: projectParamsSchema,
    body: { content: { "application/json": { schema: resolveByDedupeKeyBodySchema } } },
  },
  responses: {
    200: {
      description: "Notifications resolved by dedupe key.",
      content: { "application/json": { schema: resolveByDedupeKeyResponseSchema } },
    },
  },
});

const transitionHandler = (deps: NotificationsRouteDeps, status: "read" | "done" | "dismissed") => async (c: never) => {
  const context = asNotificationHandlerContext(c);
  const { projectId, id } = context.req.valid("param") as { projectId: string; id: string };
  const notification = await deps.notificationService.transition(projectId, id, status);
  if (!notification) return context.json({ error: "Notification not found." }, 404);
  return context.json(notification, 200);
};

export const markNotificationReadHandler = (deps: NotificationsRouteDeps) =>
  transitionHandler(deps, "read") as unknown as AppRouteHandler<typeof markNotificationReadRoute>;
export const markNotificationDoneHandler = (deps: NotificationsRouteDeps) =>
  transitionHandler(deps, "done") as unknown as AppRouteHandler<typeof markNotificationDoneRoute>;
export const dismissNotificationHandler = (deps: NotificationsRouteDeps) =>
  transitionHandler(deps, "dismissed") as unknown as AppRouteHandler<typeof dismissNotificationRoute>;

export const snoozeNotificationHandler = (
  deps: NotificationsRouteDeps,
): AppRouteHandler<typeof snoozeNotificationRoute> => {
  const handler = async (c: never) => {
    const context = asNotificationHandlerContext(c);
    const { projectId, id } = context.req.valid("param") as { projectId: string; id: string };
    const { until } = context.req.valid("json") as { until: string };
    const notification = await deps.notificationService.snooze(projectId, id, until);
    if (!notification) return context.json({ error: "Notification not found." }, 404);
    return context.json(notification, 200);
  };
  return handler as unknown as AppRouteHandler<typeof snoozeNotificationRoute>;
};

export const resolveNotificationByDedupeKeyHandler = (
  deps: NotificationsRouteDeps,
): AppRouteHandler<typeof resolveNotificationByDedupeKeyRoute> => {
  const handler = async (c: never) => {
    const context = asNotificationHandlerContext(c);
    const { projectId } = context.req.valid("param") as { projectId: string };
    const { dedupeKey, status } = context.req.valid("json") as {
      dedupeKey: string;
      status?: "done" | "dismissed" | "expired";
    };
    return context.json(await deps.notificationService.resolveByDedupeKey(projectId, dedupeKey, status), 200);
  };
  return handler as unknown as AppRouteHandler<typeof resolveNotificationByDedupeKeyRoute>;
};
