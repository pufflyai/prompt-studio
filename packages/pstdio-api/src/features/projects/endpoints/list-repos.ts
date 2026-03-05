import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema } from "../dto";

const repoResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  display_name: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const listReposRoute = createRoute({
  method: "get",
  path: "/projects/{id}/repos",
  description: "List repos linked to a project.",
  tags: ["Projects"],
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Project ID" }),
    }),
  },
  responses: {
    200: {
      description: "List of repos.",
      content: { "application/json": { schema: z.array(repoResponseSchema) } },
    },
    404: {
      description: "Project not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const listReposHandler = (deps: RouteDeps): AppRouteHandler<typeof listReposRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");

    const project = await deps.projectsService.get(id);
    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    const repos = await deps.reposService.listByProject(id);
    return c.json(repos, 200);
  };
};
