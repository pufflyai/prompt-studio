import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema, ticketResponseSchema, updateTicketBodySchema } from "../dto";

export const updateTicketRoute = createRoute({
  method: "patch",
  path: "/tickets/{id}",
  description: "Update a ticket.",
  tags: ["Tickets"],
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Ticket ID" }),
    }),
    body: {
      content: { "application/json": { schema: updateTicketBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Ticket updated.",
      content: { "application/json": { schema: ticketResponseSchema } },
    },
    404: {
      description: "Ticket not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const updateTicketHandler = (deps: RouteDeps): AppRouteHandler<typeof updateTicketRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const { tag_ids, ...input } = c.req.valid("json");

    const updated = await deps.ticketsService.update(id, input);

    if (!updated) {
      return c.json({ error: `Ticket not found: ${id}` }, 404);
    }

    if (tag_ids) {
      await deps.ticketsService.assignTags(id, tag_ids);
    }

    deps.eventBus.emit("tickets", "set", updated);

    return c.json(updated, 200);
  };
};
