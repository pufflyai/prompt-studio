import { createRoute, z } from "@hono/zod-openapi";
import { apiLogger } from "../../../lib/logger";
import type { AppRouteHandler } from "../../../types";
import { cleanupProjectArtifacts } from "../cleanup-project";
import type { ProjectsRouteDeps } from "../deps";
import { notFoundResponseSchema } from "../dto";

export const removeProjectRoute = createRoute({
  method: "delete",
  path: "/projects/{id}",
  description: "Hard-delete a project by ID. Removes all associated data, files on disk, and worktrees.",
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
  },
});

export const removeProjectHandler = (deps: ProjectsRouteDeps): AppRouteHandler<typeof removeProjectRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");

    const project = await deps.projectService.get(id);
    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    await cleanupProjectArtifacts(deps, id, {
      removeProjectStorage: deps.fileService.removeProjectStorage,
    });
    const removeConnectionSecrets = await deps.extensionConnectionService.prepareProjectRemoval(id);
    await deps.syncService.emitCascadeDeletes("projects", id);

    await deps.projectService.hardDelete(id);
    try {
      await removeConnectionSecrets();
    } catch (error) {
      apiLogger.error(
        { err: error, event: "extension.project_secret_cleanup.deferred", projectId: id },
        "Project connection secret cleanup will retry at startup",
      );
    }
    return c.body(null, 204);
  };
};
