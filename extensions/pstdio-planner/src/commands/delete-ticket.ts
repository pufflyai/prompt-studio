import { defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "../data/collections";
import { findTicket } from "../data/resolve";
import { deleteTicketBlobs } from "../data/ticket-file-content";
import { ticketRecordId } from "../data/ticket-records";
import { queueTicketWrite } from "../data/ticket-write-queue";
import { emitPlannerTicketsChanged } from "../events";
import { ticketMenuSlots } from "../resource-kinds";
import { ticketRefFromCommandContext } from "./ticket-command-ref";

import { deleteUnusedLinkedWorkspaces } from "./ticket-workspace-cleanup";

export const cleanupDeletedTicketCommand = defineCommand({
  id: "cleanup-deleted-ticket",
  title: "Clean up deleted ticket",
  mutating: true,
  automation: true,
  params: { ticketId: params.text({ required: true }) },
  async run(ctx, { ticketId }) {
    await queueTicketWrite(ticketId, async () => {
      const record = await ctx.storage.records.read(ticketRecordId(ctx.storage, ticketId));
      if (!record.deleted) return;
      // The linked workspaces are discovered before removing the ticket's anchor links.
      await deleteUnusedLinkedWorkspaces(ctx, [{ id: ticketId }]);
      await ctx.resources.removed({ type: "ticket", id: ticketId });
      await deleteTicketBlobs(ctx.storage, ticketId);
    });
  },
});

export const deleteTicketCommand = defineCommand({
  id: "delete-ticket",
  mutating: true,
  resourceMutation: { kind: "remove", resourceType: "ticket", idParam: "id" },
  title: "Delete ticket",
  cli: { examples: ["pstdio pstdio.planner delete-ticket --id PS-1"] },
  menus: [
    {
      slot: ticketMenuSlots.headerOverflow,
      label: l10n("kanbanRenderers.tickets.rowActions.delete", "Delete"),
      icon: "trash",
      placement: "last",
    },
  ],
  async run(ctx, commandParams) {
    const ref = ticketRefFromCommandContext(ctx, commandParams);
    const ticket = await findTicket(ctx, ref);
    const id = ticket?.id ?? ref;
    if (ticket && ctx.source === "dashboard") {
      await ticketsCollection(ctx).delete(id, false);
      try {
        await ctx.automation.enqueue({
          command: cleanupDeletedTicketCommand.ref,
          input: { params: { ticketId: id } },
          key: `delete-cleanup:${ctx.storage.ids.create()}`,
        });
      } catch {
        // Preserve cleanup if the durable queue is unavailable.
        await cleanupDeletedTicketCommand.run(ctx, { ticketId: id });
      }
      await emitPlannerTicketsChanged(ctx, { ticketId: id });
      return { id };
    }
    await ticketsCollection(ctx).delete(id);
    if (ticket) await deleteUnusedLinkedWorkspaces(ctx, [ticket]);
    await ctx.resources.removed({ type: "ticket", id });
    await emitPlannerTicketsChanged(ctx, { ticketId: id });
    return { id };
  },
});
