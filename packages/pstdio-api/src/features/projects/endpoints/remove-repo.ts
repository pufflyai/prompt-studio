import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema } from "../dto";

export const removeRepoRoute = createRoute({
  method: "delete",
  path: "/projects/{id}/repos/{repoId}",
  description: "Unlink a repository from a project.",
  tags: ["Projects"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        id: z.string().openapi({ description: "Project ID" }),
        repoId: z.string().openapi({ description: "Repository ID" }),
      })
      .strict(),
  },
  responses: {
    204: { description: "Repository unlinked." },
    404: {
      description: "Project or link not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const removeRepoHandler = (deps: RouteDeps): AppRouteHandler<typeof removeRepoRoute> => {
  return async (c) => {
    const { id, repoId } = c.req.valid("param");

    const link = await deps.repoService.getProjectRepoLink(id, repoId);

    if (!link) {
      return c.json({ error: "Repository link not found" }, 404);
    }

    await deps.repoService.removeFromProject(id, repoId);
    deps.eventBus.emit("project_repos", "delete", { id: link.id });

    return c.body(null, 204);
  };
};
