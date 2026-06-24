import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { NotificationsRouteDeps } from "../deps";
import { notFoundResponseSchema, notificationResponseSchema, snoozeBodySchema } from "../dto";
import { toNotification, transitionStatus } from "../notifications-service";

const idParams = z.object({ projectId: z.string(), id: z.string() }).strict();

const transitionResponses = {
  200: {
    description: "Notification updated.",
    content: { "application/json": { schema: notificationResponseSchema } },
  },
  404: {
    description: "Notification not found.",
    content: { "application/json": { schema: notFoundResponseSchema } },
  },
} as const;

export const readNotificationRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/notifications/{id}/read",
  description: "Mark notification as read.",
  tags: ["Notifications"],
  request: { params: idParams },
  responses: transitionResponses,
});

export const dismissNotificationRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/notifications/{id}/dismiss",
  description: "Dismiss a notification.",
  tags: ["Notifications"],
  request: { params: idParams },
  responses: transitionResponses,
});

export const doneNotificationRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/notifications/{id}/done",
  description: "Mark a notification as done.",
  tags: ["Notifications"],
  request: { params: idParams },
  responses: transitionResponses,
});

export const snoozeNotificationRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/notifications/{id}/snooze",
  description: "Snooze a notification until a timestamp.",
  tags: ["Notifications"],
  request: {
    params: idParams,
    body: { content: { "application/json": { schema: snoozeBodySchema } } },
  },
  responses: transitionResponses,
});

const makeTransitionHandler =
  (status: "read" | "dismissed" | "done") =>
  (deps: NotificationsRouteDeps): AppRouteHandler<typeof readNotificationRoute> => {
    return async (c) => {
      const { projectId, id } = c.req.valid("param");
      const updated = await transitionStatus(deps, { projectId, id, status });
      if (!updated) return c.json({ error: "Notification not found" }, 404);
      return c.json(toNotification(updated), 200);
    };
  };

export const readNotificationHandler = makeTransitionHandler("read");
export const dismissNotificationHandler = makeTransitionHandler("dismissed");
export const doneNotificationHandler = makeTransitionHandler("done");

export const snoozeNotificationHandler = (
  deps: NotificationsRouteDeps,
): AppRouteHandler<typeof snoozeNotificationRoute> => {
  return async (c) => {
    const { projectId, id } = c.req.valid("param");
    const { until } = c.req.valid("json");
    const updated = await transitionStatus(deps, { projectId, id, status: "snoozed", snoozedUntil: until });
    if (!updated) return c.json({ error: "Notification not found" }, 404);
    return c.json(toNotification(updated), 200);
  };
};
