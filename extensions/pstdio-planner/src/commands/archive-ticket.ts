import { defineCommand, type ExtensionStorageApi, type ExtensionWorkspace, l10n, params } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "../data/collections";
import { findTicket } from "../data/resolve";
import type { StoredTicket } from "../data/types";
import { isWorkspaceLinkedToTicket } from "../data/workspace-ticket-link";
import { ticketRefFromCommandContext } from "./ticket-command-ref";

const ARCHIVE_ALL_COLUMN_ACTION = "archive_all";

interface ArchiveTicketsContext {
  storage: ExtensionStorageApi;
  workspaces: {
    list: () => Promise<ExtensionWorkspace[]>;
    archive: (id: string) => Promise<unknown> | unknown;
  };
}

const isLinkedToAnyTicket = (workspace: ExtensionWorkspace, tickets: StoredTicket[]) => {
  for (const ticket of tickets) {
    if (isWorkspaceLinkedToTicket(workspace, ticket.shorthand)) return true;
  }
  return false;
};

const archiveTickets = async (ctx: ArchiveTicketsContext, tickets: StoredTicket[]) => {
  const updatedAt = new Date().toISOString();
  const archivedTickets = tickets.map((ticket) => ({ ...ticket, archived: true, updatedAt }));
  const collection = ticketsCollection(ctx.storage);

  await Promise.all(archivedTickets.map((ticket) => collection.put(ticket.id, ticket)));

  // Cascade: archive each ticket's attempt workspaces. The host workspaces.archive
  // primitive archives each workspace's sessions and removes its worktree.
  const linked = (await ctx.workspaces.list()).filter((workspace) => isLinkedToAnyTicket(workspace, tickets));
  await Promise.all(linked.map((workspace) => ctx.workspaces.archive(workspace.id)));

  return archivedTickets;
};

export const archiveTicketCommand = defineCommand({
  title: "Archive ticket",
  cli: { globalAliases: [["tickets", "archive"]], examples: ["pstdio tickets archive --id PS-1"] },
  menus: [
    {
      slot: "ticket.headerOverflow",
      label: l10n("dataRenderers.tickets.rowActions.archive", "Archive"),
      icon: "archive",
      placement: "last",
    },
  ],
  async run(ctx) {
    const existing = await findTicket(ctx.storage, ticketRefFromCommandContext(ctx));
    if (!existing) return null;

    const [next] = await archiveTickets(ctx, [existing]);

    return next ?? null;
  },
});

export const archiveTicketColumnActionCommand = defineCommand({
  title: "Run ticket column action",
  params: {
    columnId: params.text({ required: true }),
    actionId: params.text({ required: true }),
  },
  async run(ctx) {
    if (ctx.params.actionId !== ARCHIVE_ALL_COLUMN_ACTION) return { archived: [] };

    const tickets = (await ticketsCollection(ctx.storage).list()).filter(
      (ticket) => !ticket.archived && ticket.statusId === ctx.params.columnId,
    );
    const archived = await archiveTickets(ctx, tickets);

    return { archived };
  },
});
