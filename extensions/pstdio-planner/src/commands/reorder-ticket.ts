import { defineCommand, params } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "../data/collections";
import { plannerTicketsChanged } from "../events";
import { sortedBySortOrder } from "../utils/sort";

const moveBefore = <T extends { id: string }>(items: T[], rowId: string, beforeRowId?: string) => {
  const moving = items.find((item) => item.id === rowId);
  if (!moving) return items;

  const remaining = items.filter((item) => item.id !== rowId);
  const beforeIndex = beforeRowId ? remaining.findIndex((item) => item.id === beforeRowId) : -1;
  const insertIndex = beforeIndex === -1 ? remaining.length : beforeIndex;

  return [...remaining.slice(0, insertIndex), moving, ...remaining.slice(insertIndex)];
};

export const reorderTicketCommand = defineCommand({
  title: "Reorder ticket",
  params: {
    rowId: params.text({ required: true }),
    beforeRowId: params.text(),
  },
  async run(ctx) {
    const { rowId, beforeRowId } = ctx.params;
    const collection = ticketsCollection(ctx.storage);
    const visibleTickets = sortedBySortOrder((await collection.list()).filter((ticket) => !ticket.archived));
    const reordered = moveBefore(visibleTickets, rowId, beforeRowId);
    const now = new Date().toISOString();

    await Promise.all(
      reordered.map((ticket, sortOrder) =>
        collection.put(ticket.id, {
          ...ticket,
          sortOrder,
          updatedAt: ticket.sortOrder === sortOrder ? ticket.updatedAt : now,
        }),
      ),
    );

    await ctx.events.emit(plannerTicketsChanged, { ticketId: rowId });

    return reordered.map((ticket, sortOrder) => ({ ...ticket, sortOrder }));
  },
});
