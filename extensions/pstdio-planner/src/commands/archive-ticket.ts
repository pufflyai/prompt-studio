import { defineCommand, l10n } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "../data/collections";
import { findTicket } from "../data/resolve";
import { isWorkspaceLinkedToTicket } from "../data/workspace-ticket-link";
import { ticketRefFromCommandContext } from "./ticket-command-ref";

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

    const next = { ...existing, archived: true, updatedAt: new Date().toISOString() };
    await ticketsCollection(ctx.storage).put(existing.id, next);

    // Cascade: archive the ticket's attempt workspaces. The host workspaces.archive
    // primitive archives each workspace's sessions and removes its worktree.
    const linked = (await ctx.workspaces.list()).filter((workspace) =>
      isWorkspaceLinkedToTicket(workspace, existing.shorthand),
    );
    await Promise.all(linked.map((workspace) => ctx.workspaces.archive(workspace.id)));

    return next;
  },
});
