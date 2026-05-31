import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { ExtensionsRouteDeps } from "../deps";
import { refreshProjectSkillsInRepos, removeExtensionSkillsFromRepos } from "../extension-skill-cleanup";

const errorSchema = z.object({ error: z.string() });

export const uninstallProjectExtensionRoute = createRoute({
  method: "delete",
  path: "/projects/{projectId}/extensions/{instanceId}",
  description: "Uninstall an extension source and remove it from the project.",
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

    const existing = await deps.extensionService.getProjectExtensionInstance(projectId, instanceId);
    if (!existing) return c.json({ error: `Extension instance not found: ${instanceId}` }, 404);
    const skillsToRemove = (await deps.skillService.list(projectId)).filter(
      (skill) => skill.extension_instance_id === instanceId,
    );
    const removed = await deps.extensionService.uninstallProjectExtension({ projectId, instanceId });
    if (!removed) return c.json({ error: `Extension instance not found: ${instanceId}` }, 404);

    await removeExtensionSkillsFromRepos(deps, { owner: existing, projectId, skills: skillsToRemove });
    await refreshProjectSkillsInRepos(deps, projectId);

    return c.body(null, 204);
  };
};
