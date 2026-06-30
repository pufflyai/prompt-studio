import { join } from "node:path";
import { createRoute, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import { workbenchExtensionMetadataSchema } from "pstdio-api-contracts";
import { ProjectNotFoundError } from "../../../services/extension-service";
import type { AppBindings, AppRouteHandler } from "../../../types";
import { syncInstalledExtensionsForProject } from "../default-extensions";
import type { ExtensionsRouteDeps } from "../deps";
import { loadProjectExtensionRuntime } from "../extension-command-runtime";
import { refreshProjectSkillsInRepos } from "../extension-skill-cleanup";
import { resolvePstdioHome } from "../install-extension-source";
import { buildWorkbenchExtensionMetadata } from "../workbench-extension-metadata";

const errorSchema = z.object({ error: z.string() });

export const getProjectExtensionUiRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/extensions/ui",
  description: "Aggregated UI metadata (commands, menus, routes, views, settings) for the workbench.",
  tags: ["Extensions"],
  request: {
    params: z.object({ projectId: z.string().openapi({ description: "Project ID" }) }).strict(),
  },
  responses: {
    200: {
      description: "Workbench extension metadata.",
      content: { "application/json": { schema: workbenchExtensionMetadataSchema } },
    },
    404: {
      description: "Project not found.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

export const getProjectExtensionUiHandler = (
  deps: ExtensionsRouteDeps,
): AppRouteHandler<typeof getProjectExtensionUiRoute> => {
  const handler = async (c: Context<AppBindings>) => {
    const { projectId } = c.req.param();
    try {
      await syncInstalledExtensionsForProject({
        extensionService: deps.extensionService,
        onProjectExtensionInstancesPruned: async () => {
          await refreshProjectSkillsInRepos(deps, projectId);
        },
        projectId,
      });
      const { runtime, enabledSources } = await loadProjectExtensionRuntime(deps, projectId);
      const installNamesByExtensionId = new Map(
        enabledSources.map(({ installedSource }) => [installedSource.extension_id, installedSource.install_name]),
      );
      const installedExtensionIdsByExtensionId = new Map(
        enabledSources.map(({ installedSource }) => [installedSource.extension_id, installedSource.id]),
      );
      const assetRevisionsByExtensionId = new Map(
        enabledSources.map(({ installedSource }) => [installedSource.extension_id, installedSource.loaded_revision]),
      );
      const extensionInstanceIdsByExtensionId = new Map(
        enabledSources.map(({ installedSource, instance }) => [installedSource.extension_id, instance.id]),
      );
      const webviewCacheRoot = join(resolvePstdioHome({ env: process.env }), "cache", "extension-webviews");
      return c.json(
        buildWorkbenchExtensionMetadata({
          extensionInstanceIdsByExtensionId,
          installedExtensionIdsByExtensionId,
          installNamesByExtensionId,
          runtime,
          assetRevisionsByExtensionId,
          webviewCacheRoot,
        }),
        200,
      );
    } catch (error) {
      if (error instanceof ProjectNotFoundError) return c.json({ error: error.message }, 404);
      throw error;
    }
  };

  return handler as AppRouteHandler<typeof getProjectExtensionUiRoute>;
};
