import { type CommandContext, eventRef } from "@pstdio/sdk/extensions";

export const plannerTicketsChanged = eventRef<{ ticketId?: string }>({
  extensionId: "pstdio.pstdio-planner",
  id: "tickets.changed",
});

export const plannerSchemaChanged = eventRef({ extensionId: "pstdio.pstdio-planner", id: "schema.changed" });

export const emitPlannerTicketsChanged = (ctx: Pick<CommandContext, "events">, payload: { ticketId?: string }) =>
  ctx.events.emit(
    plannerTicketsChanged,
    payload,
    payload.ticketId ? { refresh: { resourceIds: [payload.ticketId] } } : undefined,
  );
