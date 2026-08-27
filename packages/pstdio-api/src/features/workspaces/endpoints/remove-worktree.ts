import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { WorkspacesRouteDeps } from "../deps";
import { notFoundResponseSchema } from "../dto";
import { removeWorkspaceWorktree } from "../remove-workspace-worktree";

export const removeWorkspaceWorktreeRoute = createRoute({
  method: "post",
  path: "/workspaces/{id}/remove-worktree",
  description: "Remove a workspace worktree and branch without deleting the workspace.",
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
      description: "Worktree removal attempted.",
      content: { "application/json": { schema: z.object({ removed: z.boolean() }) } },
    },
    404: {
      description: "Workspace not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const removeWorkspaceWorktreeHandler = (
  deps: WorkspacesRouteDeps,
): AppRouteHandler<typeof removeWorkspaceWorktreeRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");

    const workspace = await deps.workspaceService.get(id);
    if (!workspace) {
      return c.json({ error: `Workspace not found: ${id}` }, 404);
    }

    const removed = await removeWorkspaceWorktree(deps, workspace);
    return c.json({ removed }, 200);
  };
};
