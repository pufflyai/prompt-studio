import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema, ticketResponseSchema } from "../dto";

export const getTicketRoute = createRoute({
  method: "get",
  path: "/tickets/{id}",
  description: "Get a ticket by ID.",
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
      description: "Ticket found.",
      content: { "application/json": { schema: ticketResponseSchema } },
    },
    404: {
      description: "Ticket not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const getTicketHandler = (deps: RouteDeps): AppRouteHandler<typeof getTicketRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const ticket = await deps.ticketsService.get(id);

    if (!ticket) {
      return c.json({ error: `Ticket not found: ${id}` }, 404);
    }

    return c.json(ticket, 200);
  };
};
