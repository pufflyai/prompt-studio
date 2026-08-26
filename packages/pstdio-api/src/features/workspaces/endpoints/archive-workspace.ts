import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import { buildDiff, emitActivityEvent } from "../../activity/activity-events";
import { archiveWorkspaceCascade } from "../archive-workspace-cascade";
import type { WorkspacesRouteDeps } from "../deps";
import { notFoundResponseSchema, workspaceResponseSchema } from "../dto";

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

export const archiveWorkspaceHandler = (deps: WorkspacesRouteDeps): AppRouteHandler<typeof archiveWorkspaceRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");

    const workspace = await deps.workspaceService.get(id);
    if (!workspace) {
      return c.json({ error: `Workspace not found: ${id}` }, 404);
    }

    if (workspace.archived) {
      return c.json({ error: `Workspace already archived: ${id}` }, 409);
    }
    if (!workspace.provider_capabilities_json.archive) {
      return c.json({ error: "Workspace provider does not allow archiving." }, 409);
    }

    const updated = await archiveWorkspaceCascade(deps, workspace);
    if (!updated) {
      return c.json({ error: `Workspace not found: ${id}` }, 404);
    }

    if (!updated.archived) {
      const message = updated.provider_error_json?.message ?? `Workspace archive is ${updated.provider_state}.`;
      return c.json({ error: message }, 409);
    }

    await emitActivityEvent(deps, {
      projectId: updated.project_id,
      resourceType: "workspace",
      resourceId: updated.id,
      eventType: "workspace_archived",
      summary: `Archived workspace ${updated.workspace_shorthand}`,
      payload: {
        archived: buildDiff(false, true),
      },
    });

    return c.json(updated, 200);
  };
};
