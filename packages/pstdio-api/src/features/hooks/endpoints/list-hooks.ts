import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createRoute, z } from "@hono/zod-openapi";
import { listHooks } from "pstdio-hooks";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";

const hookResponseSchema = z.object({
  name: z.string(),
  content: z.string().nullable(),
  blocking: z.boolean(),
});

const notFoundSchema = z.object({ error: z.string() });

export const listHooksRoute = createRoute({
  method: "get",
  path: "/projects/{id}/hooks",
  description: "List all lifecycle hooks and their content for a project.",
  tags: ["Hooks"],
  request: {
    params: z.object({ id: z.string() }).strict(),
  },
  responses: {
    200: {
      description: "List of hooks.",
      content: { "application/json": { schema: z.array(hookResponseSchema) } },
    },
    404: {
      description: "Project or repo not found.",
      content: { "application/json": { schema: notFoundSchema } },
    },
  },
});

export const listHooksHandler = (deps: RouteDeps): AppRouteHandler<typeof listHooksRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");

    const project = await deps.projectService.get(id);
    if (!project) return c.json({ error: `Project not found: ${id}` }, 404);

    const repos = await deps.repoService.listByProject(id);
    if (repos.length === 0) return c.json({ error: "No repo linked to project" }, 404);

    const repoPath = repos[0].path;
    const hooks = listHooks(repoPath);

    const result = hooks.map((hook) => {
      const scriptPath = join(repoPath, ".pstdio", "hooks", hook.name);
      const content = existsSync(scriptPath) ? readFileSync(scriptPath, "utf8") : null;
      return { name: hook.name, content, blocking: hook.blocking };
    });

    return c.json(result, 200);
  };
};
