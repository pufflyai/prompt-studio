import { defineCommand, params } from "@pstdio/sdk/extensions";
import { attachmentDataUrl } from "../data/attachment-data-url";
import { getSelectedDocument, TICKET_BODY_DOCUMENT } from "../data/document-selection";
import { findTicket } from "../data/resolve";

const BODY_PLACEHOLDER = "Write the ticket description…";
const FILE_PLACEHOLDER = "Write…";

// Load command for the ticket editor. The editor is bound to the ticket; the
// files tree picks which document it shows (the body or a file/image), and this
// resolves the current selection to content the host dispatches by file type.
export const getTicketContentCommand = defineCommand({
  title: "Get ticket content",
  params: { id: params.text() },
  async run(ctx) {
    const ticketId = ctx.params.id ?? (ctx.resource?.type === "ticket" ? ctx.resource.id : undefined);
    if (!ticketId) return { content: "", placeholder: BODY_PLACEHOLDER };
    const ticket = await findTicket(ctx.storage, ticketId);
    if (!ticket) return { content: "", placeholder: BODY_PLACEHOLDER };

    const documentId = getSelectedDocument(ticket.id);
    if (documentId !== TICKET_BODY_DOCUMENT) {
      const file = ticket.files?.find((entry) => entry.id === documentId);
      if (file) return { fileName: file.name, content: file.content, placeholder: FILE_PLACEHOLDER };

      const attachment = ticket.attachments?.find((entry) => entry.id === documentId);
      if (attachment) {
        const { mimeType, dataUrl } = await attachmentDataUrl(ctx.storage, attachment);
        return { fileName: attachment.name, mimeType, dataUrl };
      }
    }

    return { content: ticket.content ?? "", placeholder: BODY_PLACEHOLDER };
  },
});
