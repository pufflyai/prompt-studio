import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { WorkspacesRouteDeps } from "../deps";
import { deleteWorkspace } from "../workspace-deletion";

export const deleteWorkspaceRoute = createRoute({
  method: "delete",
  path: "/workspaces/{id}",
  description:
    "Delete a workspace, or explicitly forget an orphaned missing-provider record without deleting remote resources.",
  tags: ["Workspaces"],
  request: {
    query: z
      .object({
        forget: z.enum(["true", "false"]).optional().openapi({
          description:
            "Discard a remote missing-provider record with no backing reference or local path. Does not remove remote resources and abandons recovery.",
        }),
      })
      .strict(),
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
    const forget = c.req.valid("query").forget === "true";

    const workspace = await deps.workspaceService.get(id);

    // The provider must release its backing resource before the row disappears;
    // a failed provider delete keeps the row so the operation can be retried.
    if (workspace) {
      try {
        await deleteWorkspace(deps, workspace, { forget });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return c.json({ error: message }, 409);
      }
    }

    return c.json({ deleted: true }, 200);
  };
};
