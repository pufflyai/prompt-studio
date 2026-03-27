import { createRoute, z } from "@hono/zod-openapi";
import { isNull } from "drizzle-orm";
import { and, eq, ticket_statuses } from "pstdio-db";
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

    const rows = await deps.db
      .select({
        id: ticket_statuses.id,
        name: ticket_statuses.name,
        color: ticket_statuses.color,
        sort_order: ticket_statuses.sort_order,
        is_default: ticket_statuses.is_default,
        can_create: ticket_statuses.can_create,
        can_drag_in: ticket_statuses.can_drag_in,
        can_drag_out: ticket_statuses.can_drag_out,
        column_actions: ticket_statuses.column_actions,
      })
      .from(ticket_statuses)
      .where(and(eq(ticket_statuses.project_id, projectId), isNull(ticket_statuses.deleted_at)))
      .orderBy(ticket_statuses.sort_order);

    const statuses = rows.map((row) => ({
      ...row,
      column_actions: JSON.parse(row.column_actions) as string[],
    }));

    return c.json(statuses, 200);
  };
};
