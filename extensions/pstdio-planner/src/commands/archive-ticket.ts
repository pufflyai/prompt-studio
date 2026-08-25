import {
  defineCommand,
  type ExtensionContextBase,
  type ExtensionStorageApi,
  type ExtensionWorkspace,
  l10n,
  params,
} from "@pstdio/sdk/extensions";
import { ticketsCollection } from "../data/collections";
import { findTicket } from "../data/resolve";
import type { StoredTicket } from "../data/types";
import { isWorkspaceLinkedToTicket } from "../data/workspace-ticket-link";
import { plannerTicketsChanged } from "../events";
import { ticketRefFromCommandContext } from "./ticket-command-ref";

const ARCHIVE_ALL_COLUMN_ACTION = "archive_all";

interface CleanupFailureNotification {
  title: string;
  body: string;
  kind: "failed";
  priority: "normal";
}

interface ArchiveTicketsContext {
  storage: ExtensionStorageApi;
  workspaces: {
    list: () => Promise<ExtensionWorkspace[]>;
    archive: (id: string) => Promise<unknown> | unknown;
  };
  notify?: {
    action?: (input: CleanupFailureNotification) => Promise<unknown> | unknown;
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

// Reports cleanup failure via a persistent notification so the user learns about it even
// after the command outcome has been returned (toast notices are collected synchronously
// into the outcome and would be lost for the column action's fire-and-forget cascade).
const reportCleanupFailure = async (ctx: ArchiveTicketsContext, error: unknown) => {
  try {
    await ctx.notify?.action?.({
      title: "Workspace cleanup failed",
      body: `Linked workspace cleanup failed after archiving the ticket: ${error instanceof Error ? error.message : String(error)}`,
      kind: "failed",
      priority: "normal",
    });
  } catch {
    // Best-effort: ticket archival has already been persisted.
  }
};

const archiveLinkedWorkspacesSafely = async (ctx: ArchiveTicketsContext, tickets: StoredTicket[]) => {
  try {
    await archiveLinkedWorkspaces(ctx, tickets);
  } catch (error) {
    await reportCleanupFailure(ctx, error);
  }
};

export const archiveTicketCommand = defineCommand({
  title: "Archive ticket",
  cli: { globalAliases: [["tickets", "archive"]], examples: ["pstdio tickets archive --id PS-1"] },
  menus: [
    {
      slot: "ticket.headerOverflow",
      label: l10n("kanbanRenderers.tickets.rowActions.archive", "Archive"),
      icon: "archive",
      placement: "last",
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
    await archiveLinkedWorkspacesSafely(ctx, [next]);
    await ctx.events.emit(plannerTicketsChanged, { ticketId: next.id });

    return next;
  },
});

export const archiveTicketColumnAction = async (
  ctx: Pick<ExtensionContextBase, "events" | "notify" | "storage" | "workspaces">,
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
  void archiveLinkedWorkspacesSafely(ctx, archived);
  await ctx.events.emit(plannerTicketsChanged, {});

  return { archived };
};

export const archiveTicketColumnActionCommand = defineCommand({
  title: "Run ticket column action",
  params: {
    columnId: params.text({ required: true }),
    actionId: params.text({ required: true }),
  },
  run: archiveTicketColumnAction,
});
