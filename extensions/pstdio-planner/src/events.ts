import { type CommandContext, eventRef } from "@pstdio/sdk/extensions";

interface PlannerTicketsChange {
  ticketId?: string;
  deleted?: true;
}

export const plannerTicketsChanged = eventRef<PlannerTicketsChange>({
  extensionId: "pstdio.planner",
  id: "tickets.changed",
});

export const plannerSchemaChanged = eventRef({ extensionId: "pstdio.planner", id: "schema.changed" });

export const emitPlannerTicketsChanged = (ctx: Pick<CommandContext, "events">, payload: PlannerTicketsChange) =>
  ctx.events.emit(
    plannerTicketsChanged,
    payload,
    payload.ticketId ? { refresh: { resourceIds: [payload.ticketId] } } : undefined,
  );
