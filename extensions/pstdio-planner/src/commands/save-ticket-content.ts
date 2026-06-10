import { defineCommand, params } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "../data/collections";
import { findTicket } from "../data/resolve";
import { deriveTitle } from "../utils/derive-title";

// Save command for the ticket-body file renderer (debounced autosave). The title
// is the start of the body, so a content save re-derives it.
export const saveTicketContentCommand = defineCommand({
  title: "Save ticket content",
  params: { id: params.text(), content: params.longText({ required: true }) },
  async run(ctx) {
    const ticketId = ctx.params.id ?? (ctx.resource?.type === "ticket" ? ctx.resource.id : undefined);
    if (!ticketId) return null;
    const existing = await findTicket(ctx.storage, ticketId);
    if (!existing) return null;

    const next = {
      ...existing,
      content: ctx.params.content,
      title: deriveTitle(ctx.params.content),
      updatedAt: new Date().toISOString(),
    };
    await ticketsCollection(ctx.storage).put(existing.id, next);
    return next;
  },
});
