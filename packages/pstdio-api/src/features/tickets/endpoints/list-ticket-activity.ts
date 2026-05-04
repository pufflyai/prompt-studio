import { createRoute, z } from "@hono/zod-openapi";
import { listTicketActivityInputSchema, listTicketActivityResponseSchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import { listActivityEvents } from "../../activity/activity-events";
import type { TicketsRouteDeps } from "../deps";

export const listTicketActivityRoute = createRoute({
  method: "get",
  path: "/tickets/{id}/activity",
  description: "List activity events for a ticket.",
  tags: ["Tickets"],
  request: {
    params: z.object({ id: z.string().openapi({ description: "Ticket ID" }) }).strict(),
    query: listTicketActivityInputSchema.strict(),
  },
  responses: {
    200: {
      description: "Ticket activity events.",
      content: { "application/json": { schema: listTicketActivityResponseSchema } },
    },
    404: {
      description: "Ticket not found.",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
  },
});

export const listTicketActivityHandler = (deps: TicketsRouteDeps): AppRouteHandler<typeof listTicketActivityRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const query = c.req.valid("query");

    const ticket = await deps.ticketService.get(id);
    if (!ticket) {
      return c.json({ error: `Ticket not found: ${id}` }, 404);
    }

    const listed = await listActivityEvents(deps, {
      projectId: ticket.project_id,
      resourceType: "ticket",
      resourceId: ticket.id,
      eventType: query.event_type,
      from: query.from,
      to: query.to,
      cursor: query.cursor,
      limit: query.limit,
    });

    return c.json(listed, 200);
  };
};
