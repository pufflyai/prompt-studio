import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema, ticketResponseSchema } from "../dto";
import { fireTicketHook, fireTicketHookAsync } from "../ticket-hooks";

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

    const existing = await deps.ticketsService.get(id);
    if (!existing) {
      return c.json({ error: `Ticket not found: ${id}` }, 404);
    }

    const preHook = await fireTicketHook(deps, "pre-ticket-deletion", existing.project_id, {
      id: existing.id,
      shorthand: existing.shorthand,
    });
    if (preHook.rejected) {
      return c.json({ error: preHook.stderr.trim() || "Rejected by pre-ticket-deletion hook" }, 403);
    }

    const deleted = await deps.ticketsService.softDelete(id);
    if (!deleted) {
      return c.json({ error: `Ticket not found: ${id}` }, 404);
    }

    deps.eventBus.emit("tickets", "set", deleted);
    fireTicketHookAsync(deps, "post-ticket-deletion", existing.project_id, {
      id: deleted.id,
      shorthand: deleted.shorthand,
    });

    return c.json(deleted, 200);
  };
};
