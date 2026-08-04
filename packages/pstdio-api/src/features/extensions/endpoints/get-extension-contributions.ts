import { createRoute, z } from "@hono/zod-openapi";
import { workbenchExtensionMetadataSchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import type { ExtensionsRouteDeps } from "../deps";
import { loadInstalledSourceRuntime } from "../extension-command-runtime";
import { assembleWorkbenchMetadata } from "../workbench-metadata-assembly";

const errorSchema = z.object({ error: z.string() });

export const getExtensionContributionsRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/extensions/{instanceId}/contributions",
  description: "Contributions declared by one extension, independent of its enabled state.",
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
      description: "The extension's declared contributions.",
      content: { "application/json": { schema: workbenchExtensionMetadataSchema } },
    },
    404: {
      description: "Extension instance not found for project.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

export const getExtensionContributionsHandler = (
  deps: ExtensionsRouteDeps,
): AppRouteHandler<typeof getExtensionContributionsRoute> => {
  return async (c) => {
    const { projectId, instanceId } = c.req.valid("param");

    const existing = await deps.extensionService.getProjectExtensionInstance(projectId, instanceId);
    if (!existing) return c.json({ error: `Extension instance not found: ${instanceId}` }, 404);

    const runtime = await loadInstalledSourceRuntime(existing.installedSource);
    return c.json(await assembleWorkbenchMetadata(deps, projectId, runtime, [existing]), 200);
  };
};
