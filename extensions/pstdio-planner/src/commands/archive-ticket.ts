import { defineCommand, params } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "../data/collections";

// Archived tickets are hidden from the board (runTicketsQuery filters them out).
export const archiveTicketCommand = defineCommand({
  title: "Archive ticket",
  params: { rowId: params.text({ required: true }) },
  async run(ctx) {
    const collection = ticketsCollection(ctx.storage);
    const existing = await collection.get(ctx.params.rowId);
    if (!existing) return null;

    const next = { ...existing, archived: true, updatedAt: new Date().toISOString() };
    await collection.put(existing.id, next);
    return next;
  },
});
