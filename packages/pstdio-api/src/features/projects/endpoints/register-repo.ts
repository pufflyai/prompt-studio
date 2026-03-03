import { createRoute, z } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { project_repos } from "pstdio-db";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema } from "../dto";

const registerRepoBodySchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
});

const repoResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  display_name: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const registerRepoRoute = createRoute({
  method: "post",
  path: "/projects/{id}/repos",
  description: "Register a repo and link it to a project.",
  tags: ["Projects"],
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Project ID" }),
    }),
    body: {
      content: { "application/json": { schema: registerRepoBodySchema } },
    },
  },
  responses: {
    201: {
      description: "Repo registered.",
      content: { "application/json": { schema: repoResponseSchema } },
    },
    404: {
      description: "Project not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const registerRepoHandler = (deps: RouteDeps): AppRouteHandler<typeof registerRepoRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const { name, path } = c.req.valid("json");

    const project = await deps.projectsService.get(id);
    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    const repo = await deps.reposService.registerForProject(id, { name, path });

    deps.eventBus.emit("repos", "set", repo);

    const [link] = await deps.db
      .select()
      .from(project_repos)
      .where(and(eq(project_repos.project_id, id), eq(project_repos.repo_id, repo.id)));
    if (link) deps.eventBus.emit("project_repos", "set", link);

    return c.json(repo, 201);
  };
};
