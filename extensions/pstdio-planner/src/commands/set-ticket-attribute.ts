import { defineCommand, type ExtensionContextBase, params } from "@pstdio/sdk/extensions";
import { putTicket, ticketsCollection } from "../data/collections";
import { ticketWithAttributes } from "../data/ticket-attributes";
import { withTicketTagIds } from "../data/ticket-tags";
import { plannerTicketsChanged } from "../events";
import { moveTicketInPlan } from "../timeline/commands/move-ticket";

export const setTicketAttribute = async (
  ctx: Pick<ExtensionContextBase, "storage" | "events" | "projectId" | "extensionId" | "settings" | "resources">,
  input: { rowId: string; attributeId: string; value?: unknown },
) => {
  if (input.attributeId === "milestone") {
    await moveTicketInPlan(ctx, {
      ticket: input.rowId,
      deadline: typeof input.value === "string" && input.value ? input.value : "none",
    });
    return ticketsCollection(ctx).get(input.rowId);
  }
  const existing = await ticketsCollection(ctx).get(input.rowId);
  if (!existing) return null;
  const next = await ticketWithAttributes(ctx.storage, existing, { [input.attributeId]: input.value });
  if (next === existing) return existing;
  const ticket = await putTicket(ctx, { ...next, updatedAt: new Date().toISOString() });
  await ctx.events.emit(plannerTicketsChanged, { ticketId: ticket.id });
  return ticket;
};

// Backs the board's inline attribute edits and drag-between-columns.
export const setTicketAttributeCommand = defineCommand({
  id: "set-ticket-attribute",
  title: "Set ticket attribute",
  params: {
    rowId: params.text({ required: true }),
    attributeId: params.text({ required: true }),
    value: params.json<string | string[]>(),
  },
  async run(ctx, commandParams) {
    const ticket = await setTicketAttribute(ctx, commandParams);
    return ticket && withTicketTagIds(ticket);
  },
});
