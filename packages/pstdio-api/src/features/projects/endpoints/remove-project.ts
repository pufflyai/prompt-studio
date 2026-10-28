import { createRoute, z } from "@hono/zod-openapi";
import { apiLogger } from "../../../lib/logger";
import type { AppRouteHandler } from "../../../types";
import { cleanupProjectArtifacts } from "../cleanup-project";
import type { ProjectsRouteDeps } from "../deps";
import { notFoundResponseSchema } from "../dto";
import { withFolderCreation } from "../project-folder";

export const removeProjectRoute = createRoute({
  method: "delete",
  path: "/projects/{id}",
  description: "Delete project data and provider-owned resources. Preserve user-selected folders.",
  tags: ["Projects"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        id: z.string().openapi({ description: "Project ID" }),
      })
      .strict(),
  },
  responses: {
    204: {
      description: "Project deleted.",
    },
    404: {
      description: "Project not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
    409: {
      description: "The project syncs with the account. Make it local first.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const removeProjectHandler = (deps: ProjectsRouteDeps): AppRouteHandler<typeof removeProjectRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");

    const project = await deps.projectService.get(id);
    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    // Every device of the account gets every cloud project, so the next account refresh would bring it back.
    if ((await deps.accountService.status()).cloudProjects.includes(id))
      return c.json(
        { error: "This project syncs with your Cloud account. Make it local in Cloud settings before deleting it." },
        409,
      );

    const home = await deps.workspaceService.getDefault(id);
    return withFolderCreation(home?.root_path ?? null, async () => {
      await cleanupProjectArtifacts(deps, id, {
        removeProjectStorage: deps.fileService.removeProjectStorage,
      });
      const removeConnectionSecrets = await deps.extensionConnectionService.prepareProjectRemoval(id);
      await deps.projectService.delete(id);
      try {
        await removeConnectionSecrets();
      } catch (error) {
        apiLogger.error(
          { err: error, event: "extension.project_secret_cleanup.deferred", projectId: id },
          "Project connection secret cleanup will retry at startup",
        );
      }
      return c.body(null, 204);
    });
  };
};
