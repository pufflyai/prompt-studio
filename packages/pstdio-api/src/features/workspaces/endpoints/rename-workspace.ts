import { createRoute, z } from "@hono/zod-openapi";
import { WorkspaceNameConflictError, WorkspaceNameValidationError, WorkspaceNotRenameableError } from "pstdio-db";
import type { AppRouteHandler } from "../../../types";
import type { WorkspacesRouteDeps } from "../deps";
import { notFoundResponseSchema, renameWorkspaceBodySchema, workspaceResponseSchema } from "../dto";

export const renameWorkspaceRoute = createRoute({
  method: "patch",
  path: "/workspaces/{id}",
  description: "Rename a workspace display name.",
  tags: ["Workspaces"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        id: z.string().openapi({ description: "Workspace ID" }),
      })
      .strict(),
    body: {
      content: { "application/json": { schema: renameWorkspaceBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Workspace renamed.",
      content: { "application/json": { schema: workspaceResponseSchema } },
    },
    400: {
      description: "Invalid workspace name.",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
    404: {
      description: "Workspace not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
    409: {
      description: "Workspace cannot be renamed or name already exists.",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
  },
});

export const renameWorkspaceHandler = (deps: WorkspacesRouteDeps): AppRouteHandler<typeof renameWorkspaceRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const { name } = c.req.valid("json");

    try {
      const workspace = await deps.workspaceService.rename(id, name);
      if (!workspace) return c.json({ error: `Workspace not found: ${id}` }, 404);

      return c.json(workspace, 200);
    } catch (error) {
      if (error instanceof WorkspaceNameValidationError) return c.json({ error: error.message }, 400);
      if (error instanceof WorkspaceNameConflictError) return c.json({ error: error.message }, 409);
      if (error instanceof WorkspaceNotRenameableError) return c.json({ error: error.message }, 409);
      throw error;
    }
  };
};
