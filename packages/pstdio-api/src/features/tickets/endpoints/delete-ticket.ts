import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema, ticketResponseSchema } from "../dto";

export const deleteTicketRoute = createRoute({
  method: "delete",
  path: "/tickets/{id}",
  description: "Soft-delete a ticket.",
  tags: ["Tickets"],
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Ticket ID" }),
    }),
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

export const deleteTicketHandler = (deps: RouteDeps): AppRouteHandler<typeof deleteTicketRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");

    const deleted = await deps.ticketsService.softDelete(id);

    if (!deleted) {
      return c.json({ error: `Ticket not found: ${id}` }, 404);
    }

    deps.eventBus.emit("tickets", "set", deleted);

    return c.json(deleted, 200);
  };
};
