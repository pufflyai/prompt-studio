import { createRoute, z } from "@hono/zod-openapi";
import { listProjectActivityForTicketsInputSchema, listTicketActivityResponseSchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import { listActivityEvents } from "../../activity/activity-events";
import type { TicketsRouteDeps } from "../deps";

export const listProjectActivityRoute = createRoute({
  method: "get",
  path: "/projects/{id}/activity",
  description: "List project activity events.",
  deprecated: true,
  tags: ["Tickets"],
  request: {
    params: z.object({ id: z.string().openapi({ description: "Project ID" }) }).strict(),
    query: listProjectActivityForTicketsInputSchema.strict(),
  },
  responses: {
    200: {
      description: "Project activity events.",
      content: { "application/json": { schema: listTicketActivityResponseSchema } },
    },
    404: {
      description: "Project not found.",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
  },
});

export const listProjectActivityHandler = (
  deps: TicketsRouteDeps,
): AppRouteHandler<typeof listProjectActivityRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const query = c.req.valid("query");

    const project = await deps.projectService.get(id);
    if (!project) {
      return c.json({ error: `Project not found: ${id}` }, 404);
    }

    const listed = await listActivityEvents(deps, {
      projectId: id,
      resourceType: query.resource_type,
      eventType: query.event_type,
      from: query.from,
      to: query.to,
      cursor: query.cursor,
      limit: query.limit,
    });

    return c.json(listed, 200);
  };
};
