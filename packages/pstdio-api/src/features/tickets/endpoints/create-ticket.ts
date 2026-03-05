import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { createTicketBodySchema, ticketResponseSchema } from "../dto";

export const createTicketRoute = createRoute({
  method: "post",
  path: "/tickets",
  description: "Create a new ticket.",
  tags: ["Tickets"],
  request: {
    body: {
      content: { "application/json": { schema: createTicketBodySchema } },
    },
  },
  responses: {
    201: {
      description: "Ticket created.",
      content: { "application/json": { schema: ticketResponseSchema } },
    },
  },
});

export const createTicketHandler = (deps: RouteDeps): AppRouteHandler<typeof createTicketRoute> => {
  return async (c) => {
    const { tag_ids, ...input } = c.req.valid("json");

    if (!input.status_id) {
      const defaultStatus = await deps.statusesService.getDefault(input.project_id);
      if (defaultStatus) input.status_id = defaultStatus.id;
    }

    const ticket = await deps.ticketsService.create(input);

    if (tag_ids && tag_ids.length > 0) {
      await deps.ticketsService.assignTags(ticket.id, tag_ids);
    }

    deps.eventBus.emit("tickets", "set", ticket);

    return c.json(ticket, 201);
  };
};
