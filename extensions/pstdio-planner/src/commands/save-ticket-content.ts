import { defineCommand, params } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "../data/collections";
import { getSelectedDocument, TICKET_BODY_DOCUMENT } from "../data/document-selection";
import { updateTicketFile } from "../data/file-operations";
import { findTicket } from "../data/resolve";
import { deriveTitle } from "../utils/derive-title";

// Save command for the ticket editor. Writes to whichever document the files tree
// has selected — the body (re-deriving the title) or the selected file.
export const saveTicketContentCommand = defineCommand({
  title: "Save ticket content",
  params: { id: params.text(), content: params.longText({ required: true }) },
  async run(ctx) {
    const ticketId = ctx.params.id ?? (ctx.resource?.type === "ticket" ? ctx.resource.id : undefined);
    if (!ticketId) return null;
    const existing = await findTicket(ctx.storage, ticketId);
    if (!existing) return null;

    const documentId = getSelectedDocument(existing.id);
    if (documentId !== TICKET_BODY_DOCUMENT && existing.files?.some((file) => file.id === documentId)) {
      return updateTicketFile({
        storage: ctx.storage,
        ticketId: existing.id,
        fileId: documentId,
        content: ctx.params.content,
      });
    }

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
