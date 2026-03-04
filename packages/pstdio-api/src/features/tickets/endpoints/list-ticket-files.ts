import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema, ticketFileResponseSchema } from "../dto";

export const listTicketFilesRoute = createRoute({
  method: "get",
  path: "/tickets/{id}/files",
  description: "List files attached to a ticket.",
  tags: ["Tickets"],
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Ticket ID" }),
    }),
  },
  responses: {
    200: {
      description: "List of files attached to the ticket.",
      content: { "application/json": { schema: z.array(ticketFileResponseSchema) } },
    },
    404: {
      description: "Ticket not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const listTicketFilesHandler = (deps: RouteDeps): AppRouteHandler<typeof listTicketFilesRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const ticket = await deps.ticketsService.get(id);

    if (!ticket) {
      return c.json({ error: `Ticket not found: ${id}` }, 404);
    }

    const files = await deps.filesService.listForTicket(id);
    return c.json(files, 200);
  };
};
