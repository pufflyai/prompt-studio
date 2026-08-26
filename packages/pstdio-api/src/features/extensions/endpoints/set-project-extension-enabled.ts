import { createRoute, z } from "@hono/zod-openapi";
import { projectExtensionInstanceSchema, setProjectExtensionEnabledRequestSchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import type { ExtensionsRouteDeps } from "../deps";
import { extensionChangesWorkspaceProvisioning, refreshProjectSkillsInRepos } from "../extension-skill-cleanup";
import { toProjectExtensionInstance } from "../project-extension-instance";

const errorSchema = z.object({ error: z.string() });

export const setProjectExtensionEnabledRoute = createRoute({
  method: "patch",
  path: "/projects/{projectId}/extensions/{instanceId}",
  description: "Enable or disable an extension instance attached to a project.",
  tags: ["Extensions"],
  request: {
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
        instanceId: z.string().openapi({ description: "Extension instance ID" }),
      })
      .strict(),
    body: {
      content: { "application/json": { schema: setProjectExtensionEnabledRequestSchema.strict() } },
    },
  },
  responses: {
    200: {
      description: "Updated extension instance.",
      content: { "application/json": { schema: projectExtensionInstanceSchema } },
    },
    404: {
      description: "Extension instance not found for project.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

export const setProjectExtensionEnabledHandler = (
  deps: ExtensionsRouteDeps,
): AppRouteHandler<typeof setProjectExtensionEnabledRoute> => {
  return async (c) => {
    const { projectId, instanceId } = c.req.valid("param");
    const { enabled } = c.req.valid("json");

    const existing = await deps.extensionService.getProjectExtensionInstance(projectId, instanceId);
    if (!existing) return c.json({ error: `Extension instance not found: ${instanceId}` }, 404);
    const refreshSkills = await extensionChangesWorkspaceProvisioning(deps, existing.installedSource);

    const updated = await deps.extensionService.setProjectExtensionEnabled(instanceId, enabled);
    if (!updated) return c.json({ error: `Extension instance not found: ${instanceId}` }, 404);

    // Only skill and provision-hook changes can alter files materialized in workspaces.
    if (refreshSkills) await refreshProjectSkillsInRepos(deps, projectId);

    return c.json(
      toProjectExtensionInstance(updated, existing.installedSource, undefined, {
        canUpgrade: await deps.extensionUpgradeService?.canUpgrade(existing.installedSource),
      }),
      200,
    );
  };
};
