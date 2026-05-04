import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import { buildDiff, emitActivityEvent } from "../../activity/activity-events";
import type { TicketsRouteDeps } from "../deps";
import { notFoundResponseSchema } from "../dto";

const bodySchema = z
  .object({
    all_attempts_status: z.string().min(1),
    set_status: z.string().min(1),
  })
  .strict();

const responseSchema = z.object({ updated: z.boolean() });

export const updateWhenAttemptStatusRoute = createRoute({
  method: "post",
  path: "/tickets/{id}/update-when-attempt-status",
  description: "Conditionally update ticket status when all workspace attempts match a given attempt status.",
  tags: ["Tickets"],
  request: {
    query: z.object({}).strict(),
    params: z.object({ id: z.string() }).strict(),
    body: {
      content: { "application/json": { schema: bodySchema } },
    },
  },
  responses: {
    200: {
      description: "Condition evaluated.",
      content: { "application/json": { schema: responseSchema } },
    },
    404: {
      description: "Ticket not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const updateWhenAttemptStatusHandler = (
  deps: TicketsRouteDeps,
): AppRouteHandler<typeof updateWhenAttemptStatusRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const { all_attempts_status, set_status } = c.req.valid("json");

    const ticket = await deps.ticketService.get(id);
    if (!ticket) {
      return c.json({ error: `Ticket not found: ${id}` }, 404);
    }

    const workspaces = await deps.workspaceService.listByTicketId(ticket.id);
    if (workspaces.length === 0) {
      return c.json({ updated: false }, 200);
    }

    // Resolve the target attempt status by name
    const targetAttemptStatus = await deps.attemptStatusService.getByName(ticket.project_id, all_attempts_status);
    if (!targetAttemptStatus) {
      return c.json({ updated: false }, 200);
    }

    const allMatch = workspaces.every((ws) => ws.attempt_status_id === targetAttemptStatus.id);
    if (!allMatch) {
      return c.json({ updated: false }, 200);
    }

    // Resolve the target ticket status by name
    const ticketStatuses = await deps.statusService.list(ticket.project_id);
    const targetTicketStatus = ticketStatuses.find((s) => s.name === set_status);
    if (!targetTicketStatus) {
      return c.json({ updated: false }, 200);
    }

    const previousTicketStatus = ticket.status_id
      ? (ticketStatuses.find((s) => s.id === ticket.status_id)?.name ?? null)
      : null;
    if (previousTicketStatus === set_status) {
      return c.json({ updated: false }, 200);
    }

    await deps.ticketService.update(ticket.id, { status_id: targetTicketStatus.id });
    await emitActivityEvent(deps, {
      projectId: ticket.project_id,
      resourceType: "ticket",
      resourceId: ticket.id,
      eventType: "ticket_attempt_status_updated",
      summary: `Updated ticket ${ticket.shorthand} from attempt statuses`,
      payload: {
        required_attempt_status: all_attempts_status,
        to_status: set_status,
        status: buildDiff(previousTicketStatus, set_status),
      },
    });
    return c.json({ updated: true }, 200);
  };
};
