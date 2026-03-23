import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema, ticketResponseSchema } from "../dto";
import { buildHookErrorMessage, queuePostTicketHooks, runPreTicketHook } from "./ticket-hooks";

export const deleteTicketRoute = createRoute({
  method: "delete",
  path: "/tickets/{id}",
  description: "Soft-delete a ticket.",
  tags: ["Tickets"],
  request: {
    query: z
      .object({
        skip_hooks: z.string().optional().openapi({ description: "Skip lifecycle hooks (pre/post)" }),
      })
      .strict(),
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
    409: {
      description: "Pre-hook rejected the operation.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const deleteTicketHandler = (deps: RouteDeps): AppRouteHandler<typeof deleteTicketRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const { skip_hooks } = c.req.valid("query");
    const skipHooks = skip_hooks === "true";

    const existing = await deps.ticketsService.get(id);
    if (!existing) {
      return c.json({ error: `Ticket not found: ${id}` }, 404);
    }

    if (!skipHooks) {
      const failure = await runPreTicketHook(deps, existing.project_id, {
        hookName: "pre-ticket-delete",
        context: {
          projectId: existing.project_id,
          ticketId: existing.id,
          ticketShorthand: existing.shorthand,
        },
      });

      if (failure) {
        return c.json({ error: buildHookErrorMessage("pre-ticket-delete", failure) }, 409);
      }
    }

    const deleted = await deps.ticketsService.softDelete(id);

    if (!deleted) {
      return c.json({ error: `Ticket not found: ${id}` }, 404);
    }

    deps.eventBus.emit("tickets", "set", deleted);

    if (!skipHooks) {
      void queuePostTicketHooks(deps, {
        projectId: deleted.project_id,
        hooks: [
          {
            hookName: "post-ticket-delete",
            context: {
              projectId: deleted.project_id,
              ticketId: deleted.id,
              ticketShorthand: deleted.shorthand,
              ticketDeletedAt: deleted.deleted_at ?? undefined,
            },
          },
        ],
      });
    }

    return c.json(deleted, 200);
  };
};
