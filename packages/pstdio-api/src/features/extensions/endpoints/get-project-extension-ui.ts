import { createRoute, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import { workbenchExtensionMetadataSchema } from "pstdio-api-contracts";
import { apiLogger } from "../../../lib/logger";
import { ProjectNotFoundError } from "../../../services/extension-service";
import type { AppBindings, AppRouteHandler } from "../../../types";
import type { ExtensionsRouteDeps, ExtensionWebviewMetadataDeps } from "../deps";
import { assembleWorkbenchMetadata } from "../workbench-metadata-assembly";

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
  deps: ExtensionsRouteDeps & ExtensionWebviewMetadataDeps,
): AppRouteHandler<typeof getProjectExtensionUiRoute> => {
  const handler = async (c: Context<AppBindings>) => {
    const { projectId } = c.req.param();
    try {
      const enabled = await deps.extensionRuntimeCatalog.get(projectId);
      // Metadata names built bundles and their styles, so it describes webviews only after their checks.
      // A failed check affects only that source's webviews; their asset requests report it.
      const checks = await Promise.allSettled(
        enabled.enabledSources.map(({ installedSource }) => deps.ensureExtensionWebviews(installedSource.id)),
      );
      checks.forEach((check, index) => {
        if (check.status === "fulfilled") return;
        apiLogger.warn(
          {
            err: check.reason,
            event: "extensions.webview_check.failed",
            installedExtensionId: enabled.enabledSources[index]?.installedSource.id,
          },
          "Extension webview check failed",
        );
      });
      const snapshot = await deps.extensionRuntimeCatalog.get(projectId);
      return c.json(await assembleWorkbenchMetadata(deps, projectId, snapshot.runtime, snapshot.enabledSources), 200);
    } catch (error) {
      if (error instanceof ProjectNotFoundError) return c.json({ error: error.message }, 404);
      throw error;
    }
  };

  return handler as AppRouteHandler<typeof getProjectExtensionUiRoute>;
};
