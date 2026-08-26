import { createRoute, z } from "@hono/zod-openapi";
import { type ExtensionWorkspace, worktreeEvents } from "pstdio-api-contracts/extension-kernel";
import type { AppRouteHandler } from "../../../types";
import { fireExtensionEventAsync } from "../../extensions/extension-event-runtime";
import type { WorkspacesRouteDeps } from "../deps";
import { deleteProviderBackedWorkspace } from "../workspace-provider-lifecycle";

type WorkspaceRecord = NonNullable<Awaited<ReturnType<WorkspacesRouteDeps["workspaceService"]["get"]>>>;

const toWorkspaceEventPayload = (workspace: WorkspaceRecord) => {
  const { anchors_json: _anchors, ...payload } = workspace;
  return payload as ExtensionWorkspace;
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

    // The default workspace is the project's root-repo entry; deleting it would
    // strip the only always-available option, so it cannot be removed.
    if (workspace?.is_default) {
      return c.json({ error: "Default workspace cannot be deleted." }, 409);
    }
    if (workspace && !workspace.provider_capabilities_json.delete) {
      return c.json({ error: "Workspace provider does not allow deletion." }, 409);
    }

    // The provider must release its backing resource before the row disappears;
    // a failed provider delete keeps the row so the operation can be retried.
    let removed = false;
    if (workspace) {
      try {
        removed = await deleteProviderBackedWorkspace(deps, workspace);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return c.json({ error: message }, 409);
      }
    }

    await deps.workspaceService.softDelete(id);

    if (workspace) {
      if (removed && workspace.worktree_path) {
        fireExtensionEventAsync(deps, workspace.project_id, worktreeEvents.removed, {
          projectId: workspace.project_id,
          worktreePath: workspace.worktree_path,
          workspace: toWorkspaceEventPayload(workspace),
          workspaceId: workspace.id,
        });
      }
    }

    return c.json({ deleted: true }, 200);
  };
};
