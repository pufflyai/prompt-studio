import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { WorkspacesRouteDeps } from "../deps";
import { workspaceListItemResponseSchema } from "../dto";
import { toExtensionWorkspace } from "../extension-workspace";

const listWorkspacesQuerySchema = z
  .object({
    project_id: z.string(),
  })
  .strict();

export const listWorkspacesRoute = createRoute({
  method: "get",
  path: "/workspaces",
  description: "List active workspaces for a project.",
  tags: ["Workspaces"],
  request: {
    query: listWorkspacesQuerySchema,
  },
  responses: {
    200: {
      description: "List of workspaces.",
      content: { "application/json": { schema: z.array(workspaceListItemResponseSchema) } },
    },
  },
});

export const listWorkspacesHandler = (deps: WorkspacesRouteDeps): AppRouteHandler<typeof listWorkspacesRoute> => {
  return async (c) => {
    const { project_id } = c.req.valid("query");
    const workspaces = await deps.workspaceService.list(project_id);
    return c.json(
      workspaces.map((workspace) => ({ ...workspace, ...toExtensionWorkspace(workspace) })),
      200,
    );
  };
};
