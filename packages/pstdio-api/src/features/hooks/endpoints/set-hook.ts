import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createRoute, z } from "@hono/zod-openapi";
import type { HookName } from "pstdio-wt";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";

const notFoundSchema = z.object({ error: z.string() });

export const setHookRoute = createRoute({
  method: "put",
  path: "/projects/{id}/hooks/{hookName}",
  description: "Create or update a lifecycle hook script.",
  tags: ["Hooks"],
  request: {
    params: z.object({ id: z.string(), hookName: z.string() }).strict(),
    body: {
      content: { "application/json": { schema: z.object({ content: z.string() }).strict() } },
    },
  },
  responses: {
    204: { description: "Hook saved." },
    404: {
      description: "Project or repo not found.",
      content: { "application/json": { schema: notFoundSchema } },
    },
  },
});

export const setHookHandler = (deps: RouteDeps): AppRouteHandler<typeof setHookRoute> => {
  return async (c) => {
    const { id, hookName } = c.req.valid("param");
    const { content } = c.req.valid("json");

    const project = await deps.projectsService.get(id);
    if (!project) return c.json({ error: `Project not found: ${id}` }, 404);

    const repos = await deps.reposService.listByProject(id);
    if (repos.length === 0) return c.json({ error: "No repo linked to project" }, 404);

    const repoPath = repos[0].path;
    const hooksDir = join(repoPath, ".pstdio", "hooks");
    mkdirSync(hooksDir, { recursive: true });
    const hookPath = join(hooksDir, hookName as HookName);
    writeFileSync(hookPath, content);
    // Hooks are spawned directly, so the script must retain execute permissions after edits.
    chmodSync(hookPath, 0o755);

    return c.body(null, 204);
  };
};
