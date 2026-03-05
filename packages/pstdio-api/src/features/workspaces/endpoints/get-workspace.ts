import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema, workspaceResponseSchema } from "../dto";

const getWorkspaceQuerySchema = z.object({
  project_id: z.string(),
  shorthand: z.string(),
});

export const getWorkspaceRoute = createRoute({
  method: "get",
  path: "/workspaces/by-shorthand",
  description: "Get a workspace by shorthand.",
  tags: ["Workspaces"],
  request: {
    query: getWorkspaceQuerySchema,
  },
  responses: {
    200: {
      description: "Workspace found.",
      content: { "application/json": { schema: workspaceResponseSchema } },
    },
    404: {
      description: "Workspace not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const getWorkspaceHandler = (deps: RouteDeps): AppRouteHandler<typeof getWorkspaceRoute> => {
  return async (c) => {
    const { project_id, shorthand } = c.req.valid("query");
    const workspace = await deps.workspacesService.getByShorthand(project_id, shorthand);

    if (!workspace) {
      return c.json({ error: `Workspace not found: ${shorthand}` }, 404);
    }

    return c.json(workspace, 200);
  };
};
