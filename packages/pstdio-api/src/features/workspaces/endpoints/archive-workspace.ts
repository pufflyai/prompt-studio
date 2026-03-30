import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema, workspaceResponseSchema } from "../dto";
import { cleanupWorkspaceWorktree } from "../worktree-cleanup";

export const archiveWorkspaceRoute = createRoute({
  method: "post",
  path: "/workspaces/{id}/archive",
  description: "Archive a workspace.",
  tags: ["Workspaces"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        id: z.string().openapi({ description: "Workspace ID" }),
      })
      .strict(),
  },
  responses: {
    200: {
      description: "Workspace archived.",
      content: { "application/json": { schema: workspaceResponseSchema } },
    },
    404: {
      description: "Workspace not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
    409: {
      description: "Workspace already archived.",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
  },
});

export const archiveWorkspaceHandler = (deps: RouteDeps): AppRouteHandler<typeof archiveWorkspaceRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");

    const workspace = await deps.workspaceService.get(id);
    if (!workspace) {
      return c.json({ error: `Workspace not found: ${id}` }, 404);
    }

    if (workspace.archived) {
      return c.json({ error: `Workspace already archived: ${id}` }, 409);
    }

    const updated = await deps.workspaceService.archive(id);
    if (!updated) {
      return c.json({ error: `Workspace not found: ${id}` }, 404);
    }

    await cleanupWorkspaceWorktree(deps, workspace);
    return c.json(updated, 200);
  };
};
