import { createRoute, z } from "@hono/zod-openapi";
import { type ExtensionWorkspace, worktreeEvents } from "@pstdio/sdk/extensions";
import type { AppRouteHandler } from "../../../types";
import { fireExtensionEventAsync } from "../../extensions/extension-event-runtime";
import type { WorkspacesRouteDeps } from "../deps";
import { notFoundResponseSchema } from "../dto";
import { cleanupWorkspaceWorktree } from "../worktree-cleanup";

type WorkspaceRecord = NonNullable<Awaited<ReturnType<WorkspacesRouteDeps["workspaceService"]["get"]>>>;

const toWorkspaceEventPayload = (workspace: WorkspaceRecord) => {
  const { anchors_json: _anchors, ...payload } = workspace;
  return payload as ExtensionWorkspace;
};

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

    const removed = await cleanupWorkspaceWorktree(deps, workspace);
    if (removed && workspace.worktree_path) {
      fireExtensionEventAsync(deps, workspace.project_id, worktreeEvents.removed, {
        projectId: workspace.project_id,
        worktreePath: workspace.worktree_path,
        workspace: toWorkspaceEventPayload(workspace),
        workspaceId: workspace.id,
      });
    }
    return c.json({ removed }, 200);
  };
};
