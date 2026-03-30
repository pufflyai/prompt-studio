import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { workspaceListItemSchema } from "../dto";

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
      content: { "application/json": { schema: z.array(workspaceListItemSchema) } },
    },
  },
});

export const listWorkspacesHandler = (deps: RouteDeps): AppRouteHandler<typeof listWorkspacesRoute> => {
  return async (c) => {
    const { project_id } = c.req.valid("query");
    const workspaces = await deps.workspaceService.list(project_id);
    return c.json(workspaces, 200);
  };
};
