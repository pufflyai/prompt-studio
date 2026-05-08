import { join } from "node:path";
import { createRoute, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import { dashboardExtensionMetadataSchema } from "pstdio-api-contracts";
import { ProjectNotFoundError } from "../../../services/extension-service";
import type { AppBindings } from "../../../types";
import { buildDashboardExtensionMetadata } from "../dashboard-extension-metadata";
import type { ExtensionsRouteDeps } from "../deps";
import { loadProjectExtensionRuntime } from "../extension-command-runtime";
import { resolvePstdioHome } from "../install-extension-source";

const errorSchema = z.object({ error: z.string() });

export const getProjectExtensionUiRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/extensions/ui",
  description: "Aggregated UI metadata (commands, menus, navigation, routes, views, settings) for the dashboard.",
  tags: ["Extensions"],
  request: {
    params: z.object({ projectId: z.string().openapi({ description: "Project ID" }) }).strict(),
  },
  responses: {
    200: {
      description: "Dashboard extension metadata.",
      content: { "application/json": { schema: dashboardExtensionMetadataSchema } },
    },
    404: {
      description: "Project not found.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

export const getProjectExtensionUiHandler = (deps: ExtensionsRouteDeps) => {
  return async (c: Context<AppBindings>) => {
    const { projectId } = c.req.param();
    try {
      const { runtime, enabledSources } = await loadProjectExtensionRuntime(deps, projectId);
      const installNamesByExtensionId = new Map(
        enabledSources.map(({ installedSource }) => [installedSource.extension_id, installedSource.install_name]),
      );
      const webviewCacheRoot = join(resolvePstdioHome({ env: process.env }), "cache", "extension-webviews");
      return c.json(buildDashboardExtensionMetadata({ runtime, installNamesByExtensionId, webviewCacheRoot }), 200);
    } catch (error) {
      if (error instanceof ProjectNotFoundError) return c.json({ error: error.message }, 404);
      throw error;
    }
  };
};
