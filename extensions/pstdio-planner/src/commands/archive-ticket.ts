import { defineCommand, params } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "../data/collections";
import { findTicket } from "../data/resolve";

// Archived tickets are hidden from the board (runTicketsQuery filters them out).
// The board sends rowId; the CLI sends --id (a shorthand).
export const archiveTicketCommand = defineCommand({
  title: "Archive ticket",
  cli: { globalAliases: [["tickets", "archive"]], examples: ["pstdio tickets archive --id T-1"] },
  params: { rowId: params.text(), id: params.text() },
  async run(ctx) {
    const existing = await findTicket(ctx.storage, ctx.params.id ?? ctx.params.rowId ?? "");
    if (!existing) return null;

    const next = { ...existing, archived: true, updatedAt: new Date().toISOString() };
    await ticketsCollection(ctx.storage).put(existing.id, next);
    return next;
  },
});
