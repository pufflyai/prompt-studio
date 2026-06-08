import { defineCommand, params } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "../data/collections";
import { findTicket, resolveStatusId } from "../data/resolve";
import { isWorkspaceLinkedToTicket } from "../data/workspace-ticket-link";
import { readWorkspaceStatusData } from "../workspace-statuses/workspace-status";

// `pst tickets update-when-attempt-status`: set the ticket status only when every
// workspace linked to the ticket already sits at the given attempt status.
export const updateWhenAttemptStatusCommand = defineCommand({
  title: "Update ticket when all attempts match",
  cli: {
    globalAliases: [["tickets", "update-when-attempt-status"]],
    examples: ["pstdio tickets update-when-attempt-status --id T-1 --all-attempts-status merged --set-status Done"],
  },
  params: {
    id: params.text({ required: true }),
    allAttemptsStatus: params.text({ required: true }),
    setStatus: params.text({ required: true }),
  },
  async run(ctx) {
    const ticket = await findTicket(ctx.storage, ctx.params.id);
    if (!ticket) throw new Error(`Unknown ticket "${ctx.params.id}"`);

    const workspaces = (await ctx.workspaces.list()).filter((ws) => isWorkspaceLinkedToTicket(ws, ticket.shorthand));
    const statusData = await readWorkspaceStatusData({
      storage: ctx.storage,
      workspaceIds: workspaces.map((workspace) => workspace.id),
    });
    const allMatch =
      workspaces.length > 0 &&
      workspaces.every(
        (workspace) => statusData.valuesByWorkspaceId[workspace.id]?.status === ctx.params.allAttemptsStatus,
      );
    if (!allMatch) return { updated: false };

    const statusId = await resolveStatusId(ctx.storage, ctx.params.setStatus);
    await ticketsCollection(ctx.storage).put(ticket.id, {
      ...ticket,
      statusId,
      updatedAt: new Date().toISOString(),
    });
    return { updated: true, status: ctx.params.setStatus };
  },
});
