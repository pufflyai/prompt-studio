import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { cleanupWorkspaceWorktree } from "../worktree-cleanup";

export const deleteWorkspaceRoute = createRoute({
  method: "delete",
  path: "/workspaces/{id}",
  description: "Soft-delete a workspace.",
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
      description: "Workspace deleted.",
      content: { "application/json": { schema: z.object({ deleted: z.boolean() }) } },
    },
  },
});

export const deleteWorkspaceHandler = (deps: RouteDeps): AppRouteHandler<typeof deleteWorkspaceRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");

    const workspace = await deps.workspacesService.get(id);
    await deps.workspacesService.softDelete(id);

    if (workspace) {
      await cleanupWorkspaceWorktree(deps, workspace);
    }

    deps.eventBus.emit("workspaces", "delete", { id });
    return c.json({ deleted: true }, 200);
  };
};
