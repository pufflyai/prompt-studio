import { defineCommand, type ExtensionContextBase, l10n, params } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "../data/collections";
import { findTicket } from "../data/resolve";
import type { StoredTicket } from "../data/types";
import { plannerTicketsChanged } from "../events";
import { ticketMenuSlots } from "../resource-kinds";
import { ticketRefFromCommandContext } from "./ticket-command-ref";

import { deleteUnusedLinkedWorkspaces, type TicketCleanupContext } from "./ticket-workspace-cleanup";

const ARCHIVE_ALL_COLUMN_ACTION = "archive_all";

const persistArchivedTickets = async (ctx: TicketCleanupContext, tickets: StoredTicket[]) => {
  const updatedAt = new Date().toISOString();
  const archivedTickets = tickets.map((ticket) => ({ ...ticket, archived: true, updatedAt }));
  const collection = ticketsCollection(ctx.storage);

  await Promise.all(archivedTickets.map((ticket) => collection.put(ticket.id, ticket)));

  return archivedTickets;
};

export const archiveTicketCommand = defineCommand({
  id: "archive-ticket",
  mutating: true,
  title: "Archive ticket",
  cli: { globalAliases: [["tickets", "archive"]], examples: ["pstdio tickets archive --id PS-1"] },
  menus: [
    {
      slot: ticketMenuSlots.headerOverflow,
      label: l10n("kanbanRenderers.tickets.rowActions.archive", "Archive"),
      icon: "archive",
      placement: "last",
      when: { metadata: { archived: false } },
    },
  ],
  async run(ctx, commandParams) {
    const existing = await findTicket(ctx.storage, ticketRefFromCommandContext(ctx, commandParams));
    if (!existing) return null;

    const [next] = await persistArchivedTickets(ctx, [existing]);
    if (!next) return null;

    // Await cascade so single-ticket UX reflects completion, but never reject:
    // the ticket is durably archived, so a cleanup failure should not be reported
    // as a failed archive. The failure surfaces via a persistent notification instead.
    await deleteUnusedLinkedWorkspaces(ctx, [next]);
    await ctx.events.emit(plannerTicketsChanged, { ticketId: next.id });

    return next;
  },
});

export const archiveTicketColumnAction = async (
  ctx: Pick<ExtensionContextBase, "events" | "notify" | "storage" | "workspaces" | "settings">,
  input: { columnId: string; actionId: string },
) => {
  if (input.actionId !== ARCHIVE_ALL_COLUMN_ACTION) return { archived: [] };

  const tickets = (await ticketsCollection(ctx.storage).list()).filter(
    (ticket) => !ticket.archived && ticket.statusId === input.columnId,
  );
  const archived = await persistArchivedTickets(ctx, tickets);

  // Fire-and-forget: return as soon as tickets are persisted so the board refresh
  // fires immediately. Linked workspaces are sync'd to the dashboard, so their UI
  // updates as the cascade completes; failures surface via a persistent notification.
  void deleteUnusedLinkedWorkspaces(ctx, archived);
  await ctx.events.emit(plannerTicketsChanged, {});

  return { archived };
};

export const archiveTicketColumnActionCommand = defineCommand({
  id: "ticket-column-action",
  title: "Run ticket column action",
  params: {
    columnId: params.text({ required: true }),
    actionId: params.text({ required: true }),
  },
  run: archiveTicketColumnAction,
});
