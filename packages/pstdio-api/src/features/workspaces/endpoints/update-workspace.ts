import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { WorkspacesRouteDeps } from "../deps";
import { notFoundResponseSchema, updateWorkspaceBodySchema, workspaceResponseSchema } from "../dto";

export const updateWorkspaceRoute = createRoute({
  method: "patch",
  path: "/workspaces/{id}",
  description: "Update a workspace.",
  tags: ["Workspaces"],
  request: {
    params: z.object({ id: z.string().openapi({ description: "Workspace ID" }) }).strict(),
    body: {
      content: { "application/json": { schema: updateWorkspaceBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Workspace updated.",
      content: { "application/json": { schema: workspaceResponseSchema } },
    },
    404: {
      description: "Workspace not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const updateWorkspaceHandler = (deps: WorkspacesRouteDeps): AppRouteHandler<typeof updateWorkspaceRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const { name } = c.req.valid("json");

    const updated = await deps.workspaceService.updateName(id, name);
    if (!updated) {
      return c.json({ error: `Workspace not found: ${id}` }, 404);
    }

    return c.json(updated, 200);
  };
};
