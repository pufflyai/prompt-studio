import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { TicketsRouteDeps } from "../deps";
import { notFoundResponseSchema, ticketResponseSchema } from "../dto";

export const deleteTicketRoute = createRoute({
  method: "delete",
  path: "/tickets/{id}",
  description: "Soft-delete a ticket.",
  tags: ["Tickets"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        id: z.string().openapi({ description: "Ticket ID" }),
      })
      .strict(),
  },
  responses: {
    200: {
      description: "Ticket deleted.",
      content: { "application/json": { schema: ticketResponseSchema } },
    },
    404: {
      description: "Ticket not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const deleteTicketHandler = (deps: TicketsRouteDeps): AppRouteHandler<typeof deleteTicketRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");

    const existing = await deps.ticketService.get(id);
    if (!existing) {
      return c.json({ error: `Ticket not found: ${id}` }, 404);
    }

    const deleted = await deps.ticketService.softDelete(id, existing.project_id);
    if (!deleted) {
      return c.json({ error: `Ticket not found: ${id}` }, 404);
    }

    return c.json(deleted, 200);
  };
};
