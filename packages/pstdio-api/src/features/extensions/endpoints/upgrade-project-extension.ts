import { createRoute, z } from "@hono/zod-openapi";
import { upgradeProjectExtensionResponseSchema } from "pstdio-api-contracts";
import { ExtensionUpgradeUnavailableError } from "../../../services/extension-upgrade-service";
import type { AppRouteHandler } from "../../../types";
import type { ExtensionsRouteDeps } from "../deps";
import { refreshProjectSkillsInRepos } from "../extension-skill-cleanup";
import { toProjectExtensionInstance } from "../project-extension-instance";

const errorSchema = z.object({ error: z.string() });

export const upgradeProjectExtensionRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/extensions/{instanceId}/upgrade",
  description: "Replace a release-managed extension with the source paired with this Prompt Studio release.",
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
    200: {
      description: "Extension source after the upgrade attempt.",
      content: { "application/json": { schema: upgradeProjectExtensionResponseSchema } },
    },
    400: {
      description: "Release source failed to install or validate.",
      content: { "application/json": { schema: errorSchema } },
    },
    404: {
      description: "Extension instance not found for project.",
      content: { "application/json": { schema: errorSchema } },
    },
    409: {
      description: "Extension source cannot be upgraded by this host.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

export const upgradeProjectExtensionHandler = (
  deps: ExtensionsRouteDeps,
): AppRouteHandler<typeof upgradeProjectExtensionRoute> => {
  return async (c) => {
    const { projectId, instanceId } = c.req.valid("param");
    if (!deps.extensionUpgradeService) {
      return c.json({ error: "This Prompt Studio host does not support extension upgrades." }, 409);
    }

    try {
      const result = await deps.extensionUpgradeService.upgrade(projectId, instanceId);
      if (!result) return c.json({ error: `Extension instance not found: ${instanceId}` }, 404);

      await refreshProjectSkillsInRepos(deps, projectId);
      return c.json(
        {
          changed: result.changed,
          extension: toProjectExtensionInstance(result.instance, result.installedSource, undefined, {
            canUpgrade: await deps.extensionUpgradeService.canUpgrade(result.installedSource),
          }),
        },
        200,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof ExtensionUpgradeUnavailableError) return c.json({ error: message }, 409);
      return c.json({ error: message }, 400);
    }
  };
};
