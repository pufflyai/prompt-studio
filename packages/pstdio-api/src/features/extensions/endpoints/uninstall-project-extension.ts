import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { ExtensionsRouteDeps } from "../deps";

const errorSchema = z.object({ error: z.string() });

export const uninstallProjectExtensionRoute = createRoute({
  method: "delete",
  path: "/projects/{projectId}/extensions/{instanceId}",
  description: "Remove an extension instance from a project. Does not delete the installed source from disk.",
  tags: ["Extensions"],
  request: {
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
        instanceId: z.string().openapi({ description: "Extension instance ID" }),
      })
      .strict(),
  },
  responses: {
    204: {
      description: "Extension instance removed.",
    },
    404: {
      description: "Extension instance not found for project.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

export const uninstallProjectExtensionHandler = (
  deps: ExtensionsRouteDeps,
): AppRouteHandler<typeof uninstallProjectExtensionRoute> => {
  return async (c) => {
    const { projectId, instanceId } = c.req.valid("param");

    const existing = await deps.extensionService.getProjectExtensionInstance(projectId, instanceId);
    if (!existing) return c.json({ error: `Extension instance not found: ${instanceId}` }, 404);

    const removed = await deps.extensionService.removeProjectExtensionInstance(instanceId);
    if (!removed) return c.json({ error: `Extension instance not found: ${instanceId}` }, 404);

    return c.body(null, 204);
  };
};
