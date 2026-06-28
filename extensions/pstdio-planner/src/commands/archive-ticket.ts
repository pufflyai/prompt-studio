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
  notify?: {
    toast?: (input: { type: "warning"; title: string; message: string }) => Promise<unknown> | unknown;
  };
}

const isLinkedToAnyTicket = (workspace: ExtensionWorkspace, tickets: StoredTicket[]) => {
  for (const ticket of tickets) {
    if (isWorkspaceLinkedToTicket(workspace, ticket.shorthand)) return true;
  }
  return false;
};

const persistArchivedTickets = async (ctx: ArchiveTicketsContext, tickets: StoredTicket[]) => {
  const updatedAt = new Date().toISOString();
  const archivedTickets = tickets.map((ticket) => ({ ...ticket, archived: true, updatedAt }));
  const collection = ticketsCollection(ctx.storage);

  await Promise.all(archivedTickets.map((ticket) => collection.put(ticket.id, ticket)));

  return archivedTickets;
};

const archiveLinkedWorkspaces = async (ctx: ArchiveTicketsContext, tickets: StoredTicket[]) => {
  // Cascade: archive each ticket's attempt workspaces. The host workspaces.archive
  // primitive archives each workspace's sessions and removes its worktree.
  const linked = (await ctx.workspaces.list()).filter((workspace) => isLinkedToAnyTicket(workspace, tickets));
  await Promise.all(linked.map((workspace) => ctx.workspaces.archive(workspace.id)));
};

const archiveLinkedWorkspacesSafely = async (ctx: ArchiveTicketsContext, tickets: StoredTicket[]) => {
  try {
    await archiveLinkedWorkspaces(ctx, tickets);
  } catch (error) {
    try {
      await ctx.notify?.toast?.({
        type: "warning",
        title: "Ticket archived",
        message: `Linked workspace cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    } catch {
      // Best-effort: ticket archival has already been persisted.
    }
  }
};

const archiveTicketsAndContinueCleanup = async (ctx: ArchiveTicketsContext, tickets: StoredTicket[]) => {
  const archivedTickets = await persistArchivedTickets(ctx, tickets);
  void archiveLinkedWorkspacesSafely(ctx, archivedTickets);

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

    const [next] = await persistArchivedTickets(ctx, [existing]);
    if (!next) return null;

    await archiveLinkedWorkspaces(ctx, [next]);

    return next;
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
    const archived = await archiveTicketsAndContinueCleanup(ctx, tickets);

    return { archived };
  },
});
