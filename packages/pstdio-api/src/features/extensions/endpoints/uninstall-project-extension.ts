import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import { listSkillAgents } from "../../harnesses/skill-agents";
import { removeAgentsSkillsFromRepos } from "../../skills/install-skill-to-repo";
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
    const skillsToRemove = (await deps.skillService.list(projectId)).filter(
      (skill) => skill.extension_instance_id === instanceId,
    );
    // Resolve the extension's harnesses before uninstalling drops them from the registry.
    const harnessAgents = (await listSkillAgents(deps.harnessRegistry)).filter(
      (agent) => agent.extensionId === existing.installedSource.extension_id,
    );
    const removed = await deps.extensionService.uninstallProjectExtension({ projectId, instanceId, deleteUserData });
    if (!removed) return c.json({ error: `Extension instance not found: ${instanceId}` }, 404);

    await removeExtensionSkillsFromRepos(deps, { owner: existing, projectId, skills: skillsToRemove });
    await removeAgentsSkillsFromRepos(deps, { projectId, agents: harnessAgents });
    await refreshProjectSkillsInRepos(deps, projectId);

    return c.body(null, 204);
  };
};
