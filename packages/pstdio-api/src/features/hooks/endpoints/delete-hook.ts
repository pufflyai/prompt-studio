import { rmSync } from "node:fs";
import { join } from "node:path";
import { createRoute, z } from "@hono/zod-openapi";
import type { HookName } from "pstdio-wt";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";

const notFoundSchema = z.object({ error: z.string() });

export const deleteHookRoute = createRoute({
  method: "delete",
  path: "/projects/{id}/hooks/{hookName}",
  description: "Delete a lifecycle hook script.",
  tags: ["Hooks"],
  request: {
    params: z.object({ id: z.string(), hookName: z.string() }).strict(),
  },
  responses: {
    204: { description: "Hook deleted." },
    404: {
      description: "Project or repo not found.",
      content: { "application/json": { schema: notFoundSchema } },
    },
  },
});

export const deleteHookHandler = (deps: RouteDeps): AppRouteHandler<typeof deleteHookRoute> => {
  return async (c) => {
    const { id, hookName } = c.req.valid("param");

    const project = await deps.projectsService.get(id);
    if (!project) return c.json({ error: `Project not found: ${id}` }, 404);

    const repos = await deps.reposService.listByProject(id);
    if (repos.length === 0) return c.json({ error: "No repo linked to project" }, 404);

    const repoPath = repos[0].path;
    const scriptPath = join(repoPath, ".pstdio", "hooks", hookName as HookName);
    rmSync(scriptPath, { force: true });

    return c.body(null, 204);
  };
};
