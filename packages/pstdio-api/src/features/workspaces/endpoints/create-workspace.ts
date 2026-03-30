import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { createWorkspaceBodySchema, workspaceResponseSchema } from "../dto";

export const createWorkspaceRoute = createRoute({
  method: "post",
  path: "/workspaces",
  description: "Create a new workspace for a ticket.",
  tags: ["Workspaces"],
  request: {
    query: z.object({}).strict(),
    body: {
      content: { "application/json": { schema: createWorkspaceBodySchema } },
    },
  },
  responses: {
    201: {
      description: "Workspace created.",
      content: { "application/json": { schema: workspaceResponseSchema } },
    },
  },
});

export const createWorkspaceHandler = (deps: RouteDeps): AppRouteHandler<typeof createWorkspaceRoute> => {
  return async (c) => {
    const input = c.req.valid("json");
    const workspace = await deps.workspaceService.create(input);
    return c.json(workspace, 201);
  };
};
