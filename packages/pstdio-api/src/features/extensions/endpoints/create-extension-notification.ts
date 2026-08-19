import { createRoute, z } from "@hono/zod-openapi";
import type { CreateNotificationInput } from "pstdio-api-contracts";
import { ProjectNotFoundError } from "../../../services/extension-service";
import type { AppRouteHandler } from "../../../types";
import { createNotificationBodySchema, notificationResponseSchema } from "../../notifications/dto";
import type { ExtensionsRouteDeps } from "../deps";

const errorSchema = z.object({ error: z.string(), extensionId: z.string().optional() });

export const createExtensionNotificationRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/extensions/{extensionId}/notifications",
  tags: ["Extensions"],
  request: {
    params: z.object({ projectId: z.string(), extensionId: z.string() }).strict(),
    body: { content: { "application/json": { schema: createNotificationBodySchema } } },
  },
  responses: {
    201: {
      description: "Notification created or updated by an enabled project extension.",
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
  const handler = async (c: never) => {
    const context = c as {
      json: (body: unknown, status: 201 | 404) => Response;
      req: { json: () => Promise<unknown>; param: () => { extensionId: string; projectId: string } };
    };
    const { extensionId, projectId } = context.req.param();
    const body = (await context.req.json()) as Omit<CreateNotificationInput, "projectId">;

    try {
      const snapshot = await deps.extensionRuntimeCatalog.get(projectId);
      const enabledSource = snapshot.enabledSources.find(
        (source) => source.installedSource.extension_id === extensionId,
      );
      if (!enabledSource) return context.json({ error: `Extension "${extensionId}" is not enabled`, extensionId }, 404);

      return context.json(
        await deps.notificationService.create({
          projectId,
          ...body,
          source: "api",
          origin: "extension",
          sourceExtensionId: enabledSource.installedSource.id,
          actorType: "system",
        }),
        201,
      );
    } catch (error) {
      if (error instanceof ProjectNotFoundError) return context.json({ error: error.message }, 404);
      throw error;
    }
  };

  return handler as unknown as AppRouteHandler<typeof createExtensionNotificationRoute>;
};
