import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";

const ticketStatusSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  sort_order: z.number(),
  is_default: z.boolean(),
  can_create: z.boolean(),
  can_drag_in: z.boolean(),
  can_drag_out: z.boolean(),
  column_actions: z.array(z.string()),
});

export const listTicketStatusesRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/ticket-statuses",
  description: "List ticket statuses for a project.",
  tags: ["Tickets"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
      })
      .strict(),
  },
  responses: {
    200: {
      description: "List of ticket statuses.",
      content: { "application/json": { schema: z.array(ticketStatusSchema) } },
    },
  },
});

export const listTicketStatusesHandler = (deps: RouteDeps): AppRouteHandler<typeof listTicketStatusesRoute> => {
  return async (c) => {
    const { projectId } = c.req.valid("param");

    const rows = await deps.statusService.list(projectId);

    const statuses = rows.map((row) => ({
      id: row.id,
      name: row.name,
      color: row.color,
      sort_order: row.sort_order,
      is_default: row.is_default,
      can_create: row.can_create,
      can_drag_in: row.can_drag_in,
      can_drag_out: row.can_drag_out,
      column_actions: JSON.parse(row.column_actions) as string[],
    }));

    return c.json(statuses, 200);
  };
};
