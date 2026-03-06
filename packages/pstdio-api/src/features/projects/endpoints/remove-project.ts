import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { emitCascadeDeletes } from "../../sync/emit-cascade-deletes";
import { cleanupProjectArtifacts } from "../cleanup-project";
import { notFoundResponseSchema } from "../dto";

export const removeProjectRoute = createRoute({
  method: "delete",
  path: "/projects/{id}",
  description: "Hard-delete a project by ID. Removes all associated data, files on disk, and worktrees.",
  tags: ["Projects"],
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Project ID" }),
    }),
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

export const removeProjectHandler = (deps: RouteDeps): AppRouteHandler<typeof removeProjectRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");

    const project = await deps.projectsService.get(id);
    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    await emitCascadeDeletes(deps.eventBus, deps.db, "projects", id);

    await cleanupProjectArtifacts(deps.db, id, {
      removeProjectStorage: deps.filesService.removeProjectStorage,
    });

    await deps.projectsService.hardDelete(id);

    return c.body(null, 204);
  };
};
