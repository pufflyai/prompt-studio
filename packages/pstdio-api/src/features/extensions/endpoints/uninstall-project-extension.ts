import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import { ExtensionProviderInUseError, type ProjectExtensionLifecycleRouteDeps } from "../project-extension-lifecycle";

const errorSchema = z.object({ error: z.string() });

export const uninstallProjectExtensionRoute = createRoute({
  method: "delete",
  path: "/projects/{projectId}/extensions/{instanceId}",
  description: "Delete the extension's files and remove it from the project.",
  tags: ["Extensions"],
  request: {
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
        instanceId: z.string().openapi({ description: "Extension instance ID" }),
      })
      .strict(),
    query: z
      .object({
        deleteUserData: z.enum(["true", "false"]).optional().openapi({
          description: "Also delete the extension's stored user data. Defaults to preserving it.",
        }),
      })
      .strict(),
  },
  responses: {
    204: {
      description: "Extension uninstalled.",
    },
    404: {
      description: "Extension instance not found for project.",
      content: { "application/json": { schema: errorSchema } },
    },
    409: {
      description: "Extension still owns provider-backed workspaces.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

export const uninstallProjectExtensionHandler = (
  deps: ProjectExtensionLifecycleRouteDeps,
): AppRouteHandler<typeof uninstallProjectExtensionRoute> => {
  return async (c) => {
    const { projectId, instanceId } = c.req.valid("param");
    const deleteUserData = c.req.valid("query").deleteUserData === "true";

    let removed: Awaited<ReturnType<typeof deps.projectExtensionLifecycle.uninstall>>;
    try {
      removed = await deps.projectExtensionLifecycle.uninstall({ projectId, instanceId, deleteUserData });
    } catch (error) {
      if (error instanceof ExtensionProviderInUseError) return c.json({ error: error.message }, 409);
      throw error;
    }
    if (!removed) return c.json({ error: `Extension instance not found: ${instanceId}` }, 404);
    return c.body(null, 204);
  };
};
