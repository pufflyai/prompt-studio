import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { buildTicketPayload } from "../build-ticket-payload";
import { notFoundResponseSchema, ticketResponseSchema } from "../dto";

const hookRejectedSchema = z.object({ error: z.string() });

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
    403: {
      description: "Rejected by pre-ticket-deletion hook.",
      content: { "application/json": { schema: hookRejectedSchema } },
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

    const existing = await deps.ticketService.get(id);
    if (!existing) {
      return c.json({ error: `Ticket not found: ${id}` }, 404);
    }

    const payload = await buildTicketPayload(deps, existing, existing.project_id);
    const outcome = await deps.ticketService.softDelete(id, existing.project_id, payload);
    if (outcome.rejected) {
      return c.json({ error: outcome.error.trim() || "Rejected by pre-ticket-deletion hook" }, 403);
    }
    if (!outcome.result) {
      return c.json({ error: `Ticket not found: ${id}` }, 404);
    }

    return c.json(outcome.result, 200);
  };
};
