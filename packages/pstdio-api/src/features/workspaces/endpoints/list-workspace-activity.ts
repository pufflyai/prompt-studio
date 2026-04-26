import { createRoute, z } from "@hono/zod-openapi";
import { listWorkspaceActivityInputSchema, listWorkspaceActivityResponseSchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import { listActivityEvents } from "../../activity/activity-events";
import type { RouteDeps } from "../../deps";

export const listWorkspaceActivityRoute = createRoute({
  method: "get",
  path: "/workspaces/{id}/activity",
  description: "List activity events for a workspace.",
  tags: ["Workspaces"],
  request: {
    params: z.object({ id: z.string().openapi({ description: "Workspace ID" }) }).strict(),
    query: listWorkspaceActivityInputSchema.strict(),
  },
  responses: {
    200: {
      description: "Workspace activity events.",
      content: { "application/json": { schema: listWorkspaceActivityResponseSchema } },
    },
    404: {
      description: "Workspace not found.",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
  },
});

export const listWorkspaceActivityHandler = (deps: RouteDeps): AppRouteHandler<typeof listWorkspaceActivityRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const query = c.req.valid("query");

    const workspace = await deps.workspaceService.get(id);
    if (!workspace) {
      return c.json({ error: `Workspace not found: ${id}` }, 404);
    }

    const listed = await listActivityEvents(deps, {
      projectId: workspace.project_id,
      resourceType: "workspace",
      resourceId: workspace.id,
      eventType: query.event_type,
      from: query.from,
      to: query.to,
      cursor: query.cursor,
      limit: query.limit,
    });

    return c.json(listed, 200);
  };
};
