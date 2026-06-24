import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import { createNotificationBodySchema, notificationResponseSchema } from "../../notifications/dto";
import { toNotification, upsertNotification } from "../../notifications/notifications-service";
import { findEnabledSource } from "../command-environment/types";
import type { ExtensionsRouteDeps } from "../deps";
import { loadProjectExtensionRuntime } from "../extension-command-runtime";

const errorSchema = z.object({ error: z.string(), code: z.string().optional(), extensionId: z.string().optional() });

export const createExtensionNotificationRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/extensions/{extensionId}/notifications",
  description: "Create or upsert a notification from an enabled project extension.",
  tags: ["Extensions"],
  request: {
    params: z.object({ projectId: z.string(), extensionId: z.string() }).strict(),
    body: { content: { "application/json": { schema: createNotificationBodySchema } } },
  },
  responses: {
    200: {
      description: "Notification created or updated.",
      content: { "application/json": { schema: notificationResponseSchema } },
    },
    404: {
      description: "Project or extension not found.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

export const createExtensionNotificationHandler = (
  deps: ExtensionsRouteDeps,
): AppRouteHandler<typeof createExtensionNotificationRoute> => {
  return async (c) => {
    const { extensionId, projectId } = c.req.valid("param");
    const body = c.req.valid("json");
    const { enabledSources } = await loadProjectExtensionRuntime(deps, projectId);
    const enabledSource = findEnabledSource(enabledSources, extensionId);
    if (!enabledSource) {
      return c.json(
        { error: `Extension "${extensionId}" is not enabled`, code: "extension_not_found", extensionId },
        404,
      );
    }

    const row = await upsertNotification(deps, {
      ...body,
      projectId,
      source: "extension",
      origin: "extension",
      sourceExtensionId: enabledSource.installedSource.id,
      actorType: "system",
      actorId: extensionId,
    });
    return c.json(toNotification(row), 200);
  };
};
