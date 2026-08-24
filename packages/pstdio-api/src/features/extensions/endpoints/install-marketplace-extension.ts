import { createRoute, z } from "@hono/zod-openapi";
import { installMarketplaceExtensionResponseSchema } from "pstdio-api-contracts";
import { ExtensionNameConflictError, ProjectNotFoundError } from "../../../services/extension-service";
import { ExtensionUpgradeUnavailableError } from "../../../services/extension-upgrade-service";
import type { AppRouteHandler } from "../../../types";
import { scheduleProjectWorkspaceProvisioning } from "../../workspaces/provision-coordinator";
import type { ExtensionsRouteDeps } from "../deps";
import { toProjectExtensionInstance } from "../project-extension-instance";

const errorSchema = z.object({ error: z.string() });

export const installMarketplaceExtensionRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/extensions/marketplace/{installName}/install",
  description: "Install a Prompt Studio marketplace extension for a project.",
  tags: ["Extensions"],
  request: {
    params: z
      .object({
        installName: z.string().openapi({ description: "Marketplace extension name" }),
        projectId: z.string().openapi({ description: "Project ID" }),
      })
      .strict(),
  },
  responses: {
    200: {
      description: "Marketplace extension installed and enabled.",
      content: { "application/json": { schema: installMarketplaceExtensionResponseSchema } },
    },
    404: {
      description: "Project not found.",
      content: { "application/json": { schema: errorSchema } },
    },
    409: {
      description: "Marketplace installation is unavailable or conflicts with another extension.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

export const installMarketplaceExtensionHandler = (
  deps: ExtensionsRouteDeps,
): AppRouteHandler<typeof installMarketplaceExtensionRoute> => {
  return async (c) => {
    const { installName, projectId } = c.req.valid("param");
    const marketplace = deps.extensionUpgradeService;
    if (!marketplace) return c.json({ error: "This Prompt Studio host does not support marketplace installs." }, 409);

    try {
      const result = await marketplace.installMarketplaceExtension(projectId, installName);
      scheduleProjectWorkspaceProvisioning(deps, projectId);
      return c.json(
        {
          extension: toProjectExtensionInstance(
            result.instance,
            result.installedSource,
            result.installedSource.source_hash,
            {
              canUpgrade: await marketplace.canUpgrade(result.installedSource),
            },
          ),
        },
        200,
      );
    } catch (error) {
      if (error instanceof ProjectNotFoundError) return c.json({ error: error.message }, 404);
      if (error instanceof ExtensionUpgradeUnavailableError || error instanceof ExtensionNameConflictError) {
        return c.json({ error: error.message }, 409);
      }
      throw error;
    }
  };
};
