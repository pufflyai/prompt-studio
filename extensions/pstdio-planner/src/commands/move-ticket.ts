import type { ExtensionContextBase, KanbanRendererMove } from "@pstdio/sdk/extensions";
import { plannerTicketsChanged } from "../events";
import { reorderTicket } from "./reorder-ticket";
import { setTicketAttribute } from "./set-ticket-attribute";

export const moveTicket = async (ctx: Pick<ExtensionContextBase, "storage" | "events">, input: KanbanRendererMove) => {
  // A drop can update several grouping fields. Refresh the board after the complete move.
  const pendingEvents = new Map<string, () => Promise<unknown>>();
  const events: ExtensionContextBase["events"] = {
    emit: async (event, payload) => {
      pendingEvents.set(typeof event === "string" ? event : event.id, () => ctx.events.emit(event, payload));
      return { delivered: 0 };
    },
  };
  const writeContext = { ...ctx, events };
  for (const [attributeId, value] of Object.entries(input.attributes)) {
    await setTicketAttribute(writeContext, { rowId: input.rowId, attributeId, value });
  }
  if (input.order) await reorderTicket(writeContext, { rowId: input.rowId, ...input.order });
  await events.emit(plannerTicketsChanged, { ticketId: input.rowId });
  for (const emit of pendingEvents.values()) await emit();
};
