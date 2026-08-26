import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { ExtensionsRouteDeps } from "../deps";
import { extensionChangesWorkspaceProvisioning, refreshProjectSkillsInRepos } from "../extension-skill-cleanup";

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
  },
});

export const uninstallProjectExtensionHandler = (
  deps: ExtensionsRouteDeps,
): AppRouteHandler<typeof uninstallProjectExtensionRoute> => {
  return async (c) => {
    const { projectId, instanceId } = c.req.valid("param");
    const deleteUserData = c.req.valid("query").deleteUserData === "true";

    const existing = await deps.extensionService.getProjectExtensionInstance(projectId, instanceId);
    if (!existing) return c.json({ error: `Extension instance not found: ${instanceId}` }, 404);
    const refreshSkills = await extensionChangesWorkspaceProvisioning(deps, existing.installedSource);

    const removed = await deps.extensionService.uninstallProjectExtension({ projectId, instanceId, deleteUserData });
    if (!removed) return c.json({ error: `Extension instance not found: ${instanceId}` }, 404);

    // Only skill and provision-hook changes can alter files materialized in workspaces.
    if (refreshSkills) await refreshProjectSkillsInRepos(deps, projectId);

    return c.body(null, 204);
  };
};
