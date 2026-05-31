import { createRoute, z } from "@hono/zod-openapi";
import { enableInstalledExtensionRequestSchema, enableInstalledExtensionResponseSchema } from "pstdio-api-contracts";
import { ExtensionNameConflictError, ProjectNotFoundError } from "../../../services/extension-service";
import type { AppRouteHandler } from "../../../types";
import { installProjectSkillsToRepo } from "../../skills/install-skill-to-repo";
import type { ExtensionsRouteDeps } from "../deps";
import { nameFromSource } from "../project-extension-instance";

const errorSchema = z.object({ error: z.string() });

export const enableInstalledExtensionRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/extensions/installed/{installName}/enable",
  description: "Enable an installed extension source for a project.",
  tags: ["Extensions"],
  request: {
    params: z
      .object({
        installName: z.string().openapi({ description: "Installed extension folder name" }),
        projectId: z.string().openapi({ description: "Project ID" }),
      })
      .strict(),
    body: {
      content: { "application/json": { schema: enableInstalledExtensionRequestSchema } },
    },
  },
  responses: {
    200: {
      description: "Extension enabled.",
      content: { "application/json": { schema: enableInstalledExtensionResponseSchema } },
    },
    404: {
      description: "Project not found.",
      content: { "application/json": { schema: errorSchema } },
    },
    409: {
      description: "Extension name conflict.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

export const enableInstalledExtensionHandler = (
  deps: ExtensionsRouteDeps,
): AppRouteHandler<typeof enableInstalledExtensionRoute> => {
  return async (c) => {
    const { installName, projectId } = c.req.valid("param");
    const body = c.req.valid("json");

    try {
      const result = await deps.extensionService.enableInstalledSourceForProject({
        projectId,
        installName,
        displayName: body.displayName,
        extensionId: body.extensionId,
        manifest: body.manifest,
        name: body.name,
        sourceHash: body.sourceHash,
        sourceKind: body.sourceKind,
        sourcePath: body.sourcePath,
        sourceRef: body.sourceRef,
        version: body.version,
      });

      const repos = await deps.repoService.listByProject(projectId);
      for (const repo of repos) {
        await installProjectSkillsToRepo(deps, { projectId, repoPath: repo.path });
      }

      return c.json(
        {
          enabled: true as const,
          installName,
          installedExtensionId: result.installedSource.id,
          instanceId: result.instance.id,
          name: nameFromSource(result.installedSource),
          projectId,
        },
        200,
      );
    } catch (error) {
      if (error instanceof ProjectNotFoundError) return c.json({ error: error.message }, 404);
      if (error instanceof ExtensionNameConflictError) return c.json({ error: error.message }, 409);
      throw error;
    }
  };
};
