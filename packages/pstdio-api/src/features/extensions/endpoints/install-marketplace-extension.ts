import { createRoute, z } from "@hono/zod-openapi";
import { installMarketplaceExtensionResponseSchema } from "pstdio-api-contracts";
import { ExtensionNameConflictError, ProjectNotFoundError } from "../../../services/extension-service";
import { ExtensionUpgradeUnavailableError } from "../../../services/extension-upgrade-service";
import type { AppRouteHandler } from "../../../types";
import type { ProjectExtensionLifecycleRouteDeps } from "../project-extension-lifecycle";

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
  deps: ProjectExtensionLifecycleRouteDeps,
): AppRouteHandler<typeof installMarketplaceExtensionRoute> => {
  return async (c) => {
    const { installName, projectId } = c.req.valid("param");
    try {
      return c.json(await deps.projectExtensionLifecycle.installMarketplace(projectId, installName), 200);
    } catch (error) {
      if (error instanceof ProjectNotFoundError) return c.json({ error: error.message }, 404);
      if (error instanceof ExtensionUpgradeUnavailableError || error instanceof ExtensionNameConflictError) {
        return c.json({ error: error.message }, 409);
      }
      throw error;
    }
  };
};
