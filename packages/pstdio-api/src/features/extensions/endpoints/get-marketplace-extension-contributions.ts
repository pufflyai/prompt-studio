import { existsSync } from "node:fs";
import { join } from "node:path";
import { createRoute, z } from "@hono/zod-openapi";
import { workbenchExtensionMetadataSchema } from "pstdio-api-contracts";
import { ExtensionUpgradeUnavailableError } from "../../../services/extension-upgrade-service";
import type { AppRouteHandler } from "../../../types";
import type { ExtensionsRouteDeps, ExtensionWebviewMetadataDeps } from "../deps";
import { loadExtensionSourceRuntime } from "../extension-runtime";
import { assembleAvailableExtensionMetadata } from "../workbench-metadata-assembly";

const errorSchema = z.object({ error: z.string() });

export const getMarketplaceExtensionContributionsRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/extensions/marketplace/{installName}/contributions",
  description: "Contributions declared by an available Prompt Studio extension.",
  tags: ["Extensions"],
  request: {
    params: z
      .object({
        installName: z.string().openapi({ description: "Available extension name" }),
        projectId: z.string().openapi({ description: "Project ID" }),
      })
      .strict(),
  },
  responses: {
    200: {
      description: "The available extension's declared contributions.",
      content: { "application/json": { schema: workbenchExtensionMetadataSchema } },
    },
    404: {
      description: "Project not found.",
      content: { "application/json": { schema: errorSchema } },
    },
    409: {
      description: "Available extension metadata cannot be prepared by this host.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

export const getMarketplaceExtensionContributionsHandler = (
  deps: ExtensionsRouteDeps & ExtensionWebviewMetadataDeps,
): AppRouteHandler<typeof getMarketplaceExtensionContributionsRoute> => {
  return async (c) => {
    const { installName, projectId } = c.req.valid("param");
    const project = await deps.projectService.get(projectId);
    if (!project) return c.json({ error: `Project not found: ${projectId}` }, 404);

    const marketplace = deps.extensionUpgradeService;
    if (!marketplace) return c.json({ error: "This Prompt Studio host does not provide available extensions." }, 409);

    try {
      const installed = await deps.extensionService.getInstalledSource(installName);
      const useInstalled = installed && existsSync(join(installed.source_path, "package.json"));
      const prepared = useInstalled ? null : await marketplace.prepareMarketplaceExtensionSource(installName);
      const sourcePath = useInstalled ? installed.source_path : prepared!.targetPath;
      const extensionId = useInstalled ? installed.extension_id : prepared!.metadata.id;
      const runtime = useInstalled
        ? await deps.extensionRuntimeCatalog.getInstalledSourceRuntime(installed)
        : await loadExtensionSourceRuntime(sourcePath);

      return c.json(
        assembleAvailableExtensionMetadata(deps, runtime, {
          extensionId,
          installName,
        }),
        200,
      );
    } catch (error) {
      if (error instanceof ExtensionUpgradeUnavailableError) return c.json({ error: error.message }, 409);
      throw error;
    }
  };
};
