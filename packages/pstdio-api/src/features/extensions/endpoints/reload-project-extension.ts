import { createRoute, z } from "@hono/zod-openapi";
import { projectExtensionInstanceSchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import { AlwaysEnabledExtensionError } from "../always-on-extensions";
import type { ExtensionsRouteDeps } from "../deps";
import { toProjectExtensionInstance } from "../project-extension-instance";

const errorSchema = z.object({ error: z.string() });

export const reloadProjectExtensionRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/extensions/{instanceId}/reload",
  description: "Retry loading an extension source and report the resulting load state.",
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
      description: "Extension instance after the reload attempt.",
      content: { "application/json": { schema: projectExtensionInstanceSchema } },
    },
    404: {
      description: "Extension instance not found for project.",
      content: { "application/json": { schema: errorSchema } },
    },
    409: {
      description: "Extension source is managed by the team owner.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

export const reloadProjectExtensionHandler = (
  deps: ExtensionsRouteDeps,
): AppRouteHandler<typeof reloadProjectExtensionRoute> => {
  return async (c) => {
    const { projectId, instanceId } = c.req.valid("param");

    const existing = await deps.extensionService.getProjectExtensionInstance(projectId, instanceId);
    if (!existing) return c.json({ error: `Extension instance not found: ${instanceId}` }, 404);

    try {
      const result = await deps.extensionService.reloadInstalledSourceBySourcePath(
        existing.installedSource.source_path,
      );
      return c.json(
        toProjectExtensionInstance(existing.instance, result.installedSource, undefined, {
          canUpgrade: await deps.extensionUpgradeService?.canUpgrade(result.installedSource),
        }),
        200,
      );
    } catch (error) {
      if (error instanceof AlwaysEnabledExtensionError) return c.json({ error: error.message }, 409);
      throw error;
    }
  };
};
