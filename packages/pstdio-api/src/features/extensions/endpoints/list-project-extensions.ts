import { createRoute, z } from "@hono/zod-openapi";
import { listProjectExtensionsResponseSchema } from "pstdio-api-contracts";
import { ProjectNotFoundError } from "../../../services/extension-service";
import type { AppRouteHandler } from "../../../types";
import { syncInstalledExtensionsForProject } from "../default-extensions";
import type { ExtensionsRouteDeps } from "../deps";
import { refreshProjectSkillsInRepos } from "../extension-skill-cleanup";
import { toProjectExtensionInstance } from "../project-extension-instance";

const errorSchema = z.object({ error: z.string() });

export const listProjectExtensionsRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/extensions",
  description: "List every extension instance attached to a project, including disabled ones.",
  tags: ["Extensions"],
  request: {
    params: z.object({ projectId: z.string().openapi({ description: "Project ID" }) }).strict(),
  },
  responses: {
    200: {
      description: "Project extension instances.",
      content: { "application/json": { schema: listProjectExtensionsResponseSchema } },
    },
    404: {
      description: "Project not found.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

export const listProjectExtensionsHandler = (
  deps: ExtensionsRouteDeps,
): AppRouteHandler<typeof listProjectExtensionsRoute> => {
  return async (c) => {
    const { projectId } = c.req.valid("param");
    try {
      const synced = await syncInstalledExtensionsForProject({
        extensionService: deps.extensionService,
        onProjectExtensionInstancesPruned: async () => {
          await refreshProjectSkillsInRepos(deps, projectId);
        },
        projectId,
      });
      // The sync pass already hashed every folder on disk; compare against what the project adopted.
      const diskHashes = new Map(synced.map((entry) => [entry.installName, entry.sourceHash]));
      const records = await deps.extensionService.listProjectExtensionInstances(projectId);
      const extensions = records.map(({ instance, installedSource }) =>
        toProjectExtensionInstance(instance, installedSource, diskHashes.get(installedSource.install_name)),
      );
      return c.json({ extensions }, 200);
    } catch (error) {
      if (error instanceof ProjectNotFoundError) return c.json({ error: error.message }, 404);
      throw error;
    }
  };
};
