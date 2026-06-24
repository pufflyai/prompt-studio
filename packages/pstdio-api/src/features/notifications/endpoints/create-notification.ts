import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { NotificationsRouteDeps } from "../deps";
import { createNotificationBodySchema, notFoundResponseSchema, notificationResponseSchema } from "../dto";
import { toNotification, upsertNotification } from "../notifications-service";

export const createNotificationRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/notifications",
  description: "Create or upsert a notification. Upserts when a live row with the same dedupeKey exists.",
  tags: ["Notifications"],
  request: {
    params: z.object({ projectId: z.string() }).strict(),
    body: { content: { "application/json": { schema: createNotificationBodySchema } } },
  },
  responses: {
    200: {
      description: "Notification created or updated.",
      content: { "application/json": { schema: notificationResponseSchema } },
    },
    404: {
      description: "Project not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const createNotificationHandler = (
  deps: NotificationsRouteDeps,
): AppRouteHandler<typeof createNotificationRoute> => {
  return async (c) => {
    const { projectId } = c.req.valid("param");
    const body = c.req.valid("json");

    const project = await deps.projectService.get(projectId);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const row = await upsertNotification(deps, { ...body, projectId });
    return c.json(toNotification(row), 200);
  };
};
