import { defineCommand, l10n } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "../data/collections";
import { findTicket } from "../data/resolve";
import { plannerTicketsChanged } from "../events";
import { ticketMenuSlots } from "../resource-kinds";
import { ticketRefFromCommandContext } from "./ticket-command-ref";

// Deleted workspaces are not restored. A restored ticket can start work in a new workspace.
export const unarchiveTicketCommand = defineCommand({
  id: "unarchive-ticket",
  mutating: true,
  title: "Unarchive ticket",
  cli: { globalAliases: [["tickets", "unarchive"]], examples: ["pstdio tickets unarchive --id PS-1"] },
  menus: [
    {
      slot: ticketMenuSlots.headerOverflow,
      label: l10n("kanbanRenderers.tickets.rowActions.unarchive", "Unarchive"),
      icon: "archive-restore",
      placement: "last",
      when: { metadata: { archived: true } },
    },
  ],
  async run(ctx, commandParams) {
    const existing = await findTicket(ctx.storage, ticketRefFromCommandContext(ctx, commandParams));
    if (!existing) return null;
    if (!existing.archived) return existing;

    const next = { ...existing, archived: false, updatedAt: new Date().toISOString() };
    await ticketsCollection(ctx.storage).put(next.id, next);
    await ctx.events.emit(plannerTicketsChanged, { ticketId: next.id });
    return next;
  },
});
