import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { plannerTicketsChanged } from "../events";
import { ticketsCollection } from "./collections";
import { reconcileDependencyBlockers } from "./reconcile-dependency-blockers";
import { readMergeDestination } from "./workflow-statuses";

export const markTicketsDone = async (
  ctx: Pick<ExtensionContextBase, "storage" | "settings" | "events" | "projectId" | "extensionId" | "resources">,
  ticketIds: string[],
) => {
  if ((await ctx.settings.get("tickets.markDoneOnMerge")) === false) return;
  const { status: done, reason } = await readMergeDestination(ctx);
  if (!done) return { reason };
  for (const id of new Set(ticketIds)) {
    const ticket = await ticketsCollection(ctx).get(id);
    if (!ticket || ticket.archived || ticket.statusId === done.id) continue;
    await ticketsCollection(ctx).put(id, {
      ...ticket,
      statusId: done.id,
      blockedReason: null,
      updatedAt: new Date().toISOString(),
    });
    await ctx.events.emit(plannerTicketsChanged, { ticketId: id });
  }
  await reconcileDependencyBlockers(ctx);
};
