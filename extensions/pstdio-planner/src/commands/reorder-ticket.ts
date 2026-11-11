import { defineCommand, type ExtensionContextBase, params } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "../data/collections";
import { readMigratedTickets } from "../data/read-migrated-tickets";
import { ticketOrderChanges } from "../data/ticket-order";
import { withWriteGuard } from "../data/write-guard";
import { plannerTicketsChanged } from "../events";

export const reorderTicket = async (
  ctx: Pick<
    ExtensionContextBase,
    "events" | "storage" | "projectId" | "extensionId" | "resources" | "commands" | "extensionId" | "files"
  >,
  input: { rowId: string; beforeRowId?: string },
) =>
  withWriteGuard(ctx, "ticket-order", async () => {
    const collection = ticketsCollection(ctx);
    const changes = ticketOrderChanges(ctx.storage, await readMigratedTickets(ctx), input.rowId, input.beforeRowId);
    const now = new Date().toISOString();
    for (const ticket of changes)
      await collection.change(ticket.id, async (current) => ({
        ...current,
        position: ticket.position,
        updatedAt: now,
      }));
    if (changes.length) await ctx.events.emit(plannerTicketsChanged, { ticketId: input.rowId });
    return { changed: changes.length };
  });

export const reorderTicketCommand = defineCommand({
  id: "reorder-ticket",
  title: "Reorder ticket",
  params: { rowId: params.text({ required: true }), beforeRowId: params.text() },
  run: reorderTicket,
});
