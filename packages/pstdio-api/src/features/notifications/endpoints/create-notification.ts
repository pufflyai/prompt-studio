import { createRoute } from "@hono/zod-openapi";
import type { CreateNotificationInput } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import type { NotificationsRouteDeps } from "../deps";
import { createNotificationBodySchema, notificationResponseSchema, projectParamsSchema } from "../dto";
import { asNotificationHandlerContext } from "../handler-context";

export const createNotificationRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/notifications",
  tags: ["Notifications"],
  request: {
    params: projectParamsSchema,
    body: { content: { "application/json": { schema: createNotificationBodySchema } } },
  },
  responses: {
    201: {
      description: "Notification created or updated by dedupe key.",
      content: { "application/json": { schema: notificationResponseSchema } },
    },
  },
});

export const createNotificationHandler = (
  deps: NotificationsRouteDeps,
): AppRouteHandler<typeof createNotificationRoute> => {
  const handler = async (c: never) => {
    const context = asNotificationHandlerContext(c);
    const { projectId } = context.req.valid("param") as { projectId: string };
    const body = context.req.valid("json") as Omit<CreateNotificationInput, "projectId">;
    return context.json(await deps.notificationService.create({ projectId, ...body }), 201);
  };
  return handler as unknown as AppRouteHandler<typeof createNotificationRoute>;
};
