import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { plannerTicketsChanged } from "../events";
import { statusesCollection, ticketsCollection } from "./collections";

export const markTicketsDone = async (
  ctx: Pick<ExtensionContextBase, "storage" | "settings" | "events">,
  ticketIds: string[],
) => {
  if ((await ctx.settings.get("tickets.markDoneOnMerge")) === false) return;
  const done = (await statusesCollection(ctx.storage).list()).find(
    (status) => status.name.trim().toLowerCase() === "done",
  );
  if (!done) return;
  for (const id of new Set(ticketIds)) {
    const ticket = await ticketsCollection(ctx.storage).get(id);
    if (!ticket || ticket.archived || ticket.statusId === done.id) continue;
    await ticketsCollection(ctx.storage).put(id, {
      ...ticket,
      statusId: done.id,
      blockedReason: null,
      updatedAt: new Date().toISOString(),
    });
    await ctx.events.emit(plannerTicketsChanged, { ticketId: id });
  }
};
