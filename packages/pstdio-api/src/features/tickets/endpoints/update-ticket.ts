import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema, ticketResponseSchema, updateTicketBodySchema } from "../dto";
import { TicketUpdateRejectedError, updateTicketWithHooks } from "../update-ticket-operation";

const hookRejectedSchema = z.object({ error: z.string() });

export const updateTicketRoute = createRoute({
  method: "patch",
  path: "/tickets/{id}",
  description: "Update a ticket.",
  tags: ["Tickets"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        id: z.string().openapi({ description: "Ticket ID" }),
      })
      .strict(),
    body: {
      content: { "application/json": { schema: updateTicketBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Ticket updated.",
      content: { "application/json": { schema: ticketResponseSchema } },
    },
    403: {
      description: "Rejected by hook.",
      content: { "application/json": { schema: hookRejectedSchema } },
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

    try {
      const updated = await updateTicketWithHooks(deps, id, c.req.valid("json"));

      if (!updated) {
        return c.json({ error: `Ticket not found: ${id}` }, 404);
      }

      return c.json(updated, 200);
    } catch (error) {
      if (error instanceof TicketUpdateRejectedError) {
        return c.json({ error: error.message }, 403);
      }
      throw error;
    }
  };
};
