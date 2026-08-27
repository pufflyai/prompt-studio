import { createRoute, z } from "@hono/zod-openapi";
import { type ExtensionWorkspace, worktreeEvents } from "pstdio-api-contracts/extension-kernel";
import type { AppRouteHandler } from "../../../types";
import { fireExtensionEventAsync } from "../../extensions/extension-event-runtime";
import type { WorkspacesRouteDeps } from "../deps";
import { assertWorkspaceDeleteAllowed, deleteProviderBackedWorkspace } from "../workspace-provider-lifecycle";

type WorkspaceRecord = NonNullable<Awaited<ReturnType<WorkspacesRouteDeps["workspaceService"]["get"]>>>;

const toWorkspaceEventPayload = (workspace: WorkspaceRecord) => {
  const { anchors_json: _anchors, ...payload } = workspace;
  return payload as ExtensionWorkspace;
};

const releaseWorkspaceBackingResource = async (deps: WorkspacesRouteDeps, workspace: WorkspaceRecord) => {
  assertWorkspaceDeleteAllowed(workspace);
  return deleteProviderBackedWorkspace(deps, workspace);
};

const fireWorkspaceRemovedEvent = (deps: WorkspacesRouteDeps, workspace: WorkspaceRecord) => {
  if (!workspace.worktree_path) return;
  fireExtensionEventAsync(deps, workspace.project_id, worktreeEvents.removed, {
    projectId: workspace.project_id,
    worktreePath: workspace.worktree_path,
    workspace: toWorkspaceEventPayload(workspace),
    workspaceId: workspace.id,
  });
};

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
    409: {
      description: "Workspace cannot be deleted.",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
  },
});

export const deleteWorkspaceHandler = (deps: WorkspacesRouteDeps): AppRouteHandler<typeof deleteWorkspaceRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");

    const workspace = await deps.workspaceService.get(id);

    // The provider must release its backing resource before the row disappears;
    // a failed provider delete keeps the row so the operation can be retried.
    let removed = false;
    if (workspace) {
      try {
        removed = await releaseWorkspaceBackingResource(deps, workspace);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return c.json({ error: message }, 409);
      }
    }

    await deps.workspaceService.softDelete(id);

    if (workspace && removed) fireWorkspaceRemovedEvent(deps, workspace);

    return c.json({ deleted: true }, 200);
  };
};
