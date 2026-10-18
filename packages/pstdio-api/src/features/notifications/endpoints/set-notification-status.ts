import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { NotificationsRouteDeps } from "../deps";
import { notificationParamsSchema, notificationResponseSchema, projectParamsSchema } from "../dto";

const statusBody = z.discriminatedUnion("status", [
  z.object({ status: z.enum(["read", "done", "dismissed"]) }).strict(),
  z.object({ status: z.literal("snoozed"), snoozedUntil: z.iso.datetime() }).strict(),
]);
const keyBody = z.discriminatedUnion("status", [
  z.object({ key: z.string(), status: z.enum(["read", "done", "dismissed"]) }).strict(),
  z.object({ key: z.string(), status: z.literal("snoozed"), snoozedUntil: z.iso.datetime() }).strict(),
]);
export const setNotificationStatusRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/notifications/{id}/status",
  tags: ["Notifications"],
  request: { params: notificationParamsSchema, body: { content: { "application/json": { schema: statusBody } } } },
  responses: {
    200: {
      description: "Current notification, or null if absent in this project.",
      content: { "application/json": { schema: notificationResponseSchema.nullable() } },
    },
  },
});
export const setNotificationStatusByKeyRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/notifications/status-by-key",
  tags: ["Notifications"],
  request: { params: projectParamsSchema, body: { content: { "application/json": { schema: keyBody } } } },
  responses: {
    200: {
      description: "Current notifications with this key.",
      content: { "application/json": { schema: z.array(notificationResponseSchema) } },
    },
  },
});
export const setNotificationStatusHandler =
  (deps: NotificationsRouteDeps): AppRouteHandler<typeof setNotificationStatusRoute> =>
  async (c) => {
    const { projectId, id } = c.req.valid("param");
    return c.json(await deps.notificationService.setStatus(projectId, id, c.req.valid("json")), 200);
  };
export const setNotificationStatusByKeyHandler =
  (deps: NotificationsRouteDeps): AppRouteHandler<typeof setNotificationStatusByKeyRoute> =>
  async (c) => {
    const { projectId } = c.req.valid("param");
    const { key, ...input } = c.req.valid("json");
    return c.json(await deps.notificationService.setStatusByKey(projectId, key, input), 200);
  };
