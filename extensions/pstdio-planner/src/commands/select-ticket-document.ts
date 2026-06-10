import { defineCommand, params } from "@pstdio/sdk/extensions";
import { setSelectedDocument, TICKET_BODY_DOCUMENT } from "../data/document-selection";

// Run by the files-tree nodes to choose which document the ticket editor shows
// (the body or a file). The editor reloads afterwards and reads the selection.
export const selectTicketDocumentCommand = defineCommand({
  title: "Select ticket document",
  params: {
    ticketId: params.text({ required: true }),
    documentId: params.text(),
  },
  async run(ctx) {
    const documentId = ctx.params.documentId || TICKET_BODY_DOCUMENT;
    setSelectedDocument(ctx.params.ticketId, documentId);
    return { ticketId: ctx.params.ticketId, documentId };
  },
});
