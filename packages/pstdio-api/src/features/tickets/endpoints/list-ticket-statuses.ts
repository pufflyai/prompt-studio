import { createRoute, z } from "@hono/zod-openapi";
import { eq, ticket_statuses } from "pstdio-db";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";

const ticketStatusSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  sort_order: z.number(),
  is_default: z.boolean(),
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

    const statuses = await deps.db
      .select({
        id: ticket_statuses.id,
        name: ticket_statuses.name,
        color: ticket_statuses.color,
        sort_order: ticket_statuses.sort_order,
        is_default: ticket_statuses.is_default,
      })
      .from(ticket_statuses)
      .where(eq(ticket_statuses.project_id, projectId))
      .orderBy(ticket_statuses.sort_order);

    return c.json(statuses, 200);
  };
};
