import { defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "../data/collections";
import { findStoredTicket } from "../data/resolve";
import { deleteTicketBlobs } from "../data/ticket-file-content";
import { ticketRecordId, ticketRecords } from "../data/ticket-records";
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
      await emitPlannerTicketsChanged(ctx, { ticketId, deleted: true });
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
    if (ctx.source === "dashboard") {
      if (!ref) throw new Error("A ticket ID is required to delete a ticket.");
      const found = await queueTicketWrite(ref, () =>
        ticketRecords(ctx.storage).delete(ref, async () => {
          // Admit the durable job before committing. The job waits on this ticket's queue
          // and checks the tombstone, so a failed commit never removes a live ticket's data.
          await ctx.automation.enqueue({
            command: cleanupDeletedTicketCommand.ref,
            input: { params: { ticketId: ref } },
            key: `delete-cleanup:${ctx.storage.ids.create()}`,
          });
        }),
      );
      if (!found) throw new Error(`Unknown ticket "${ref}"`);
      return { id: ref };
    }
    const ticket = await findStoredTicket(ctx, ref);
    const id = ticket?.id ?? ref;
    await ticketsCollection(ctx).delete(id);
    if (ticket) await deleteUnusedLinkedWorkspaces(ctx, [ticket]);
    await ctx.resources.removed({ type: "ticket", id });
    await emitPlannerTicketsChanged(ctx, { ticketId: id, deleted: true });
    return { id };
  },
});
