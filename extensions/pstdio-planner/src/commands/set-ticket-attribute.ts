import { defineCommand, type ExtensionContextBase, params } from "@pstdio/sdk/extensions";
import { ticketsCollection, withDerivedTicketState } from "../data/collections";
import { publishTicketChanges } from "../data/ticket-activity";
import { ticketWithAttributes } from "../data/ticket-attributes";
import { readTicketIdentity } from "../data/ticket-identity";
import { changeTicketRecord } from "../data/ticket-records";
import { withTicketTagIds } from "../data/ticket-tags";
import { queueTicketWrite } from "../data/ticket-write-queue";
import type { StoredTicket, Ticket } from "../data/types";
import { emitPlannerTicketsChanged } from "../events";
import { moveTicketInPlan } from "../timeline/commands/move-ticket";

export const setTicketAttribute = async (
  ctx: Pick<ExtensionContextBase, "storage" | "events" | "projectId" | "extensionId" | "settings" | "resources"> &
    Partial<Pick<ExtensionContextBase, "activity">>,
  input: { rowId: string; attributeId: string; value?: unknown },
) => {
  if (input.attributeId === "milestone") {
    await moveTicketInPlan(ctx, {
      ticket: input.rowId,
      deadline: typeof input.value === "string" && input.value ? input.value : "none",
    });
    return ticketsCollection(ctx).get(input.rowId);
  }
  const result: { ticket?: Ticket; changed: boolean } = { changed: false };
  const saved = await queueTicketWrite(input.rowId, async () => {
    let before: StoredTicket | undefined;
    const saved = await changeTicketRecord(ctx.storage, input.rowId, async (current) => {
      before = current;
      result.ticket = await readTicketIdentity(ctx, current);
      result.changed = false;
      if (!result.ticket) return current;
      const next = await ticketWithAttributes(ctx.storage, result.ticket, { [input.attributeId]: input.value });
      if (next === result.ticket) return current;
      result.changed = true;
      result.ticket = await withDerivedTicketState(ctx, { ...next, updatedAt: new Date().toISOString() });
      return result.ticket;
    });
    if (saved && before && result.changed) await publishTicketChanges(ctx, before, saved);
    return saved;
  });
  const { ticket, changed } = result;
  if (!saved || !ticket) return null;
  if (changed) await emitPlannerTicketsChanged(ctx, { ticketId: ticket.id });
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
