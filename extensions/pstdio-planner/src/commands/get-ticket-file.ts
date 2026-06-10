import { defineCommand, params } from "@pstdio/sdk/extensions";
import { attachmentDataUrl } from "../data/attachment-data-url";
import { ticketsCollection } from "../data/collections";
import { parseTicketFileResourceId } from "../data/ticket-file-ref";

// Load command for the ticket-file renderer. One `ticket-file` resource covers
// both editable text files and read-only image attachments; the returned shape
// (content vs dataUrl + fileName/mimeType) drives the host's markdown/code/image
// dispatch.
export const getTicketFileCommand = defineCommand({
  title: "Get ticket file",
  params: { id: params.text() },
  async run(ctx) {
    const raw = ctx.params.id ?? (ctx.resource?.type === "ticket-file" ? ctx.resource.id : undefined);
    const parsed = parseTicketFileResourceId(raw);
    if (!parsed) return { content: "" };

    const ticket = await ticketsCollection(ctx.storage).get(parsed.ticketId);
    if (!ticket) return { content: "" };

    const file = ticket.files?.find((entry) => entry.id === parsed.entryId);
    if (file) return { fileName: file.name, content: file.content };

    const attachment = ticket.attachments?.find((entry) => entry.id === parsed.entryId);
    if (attachment) {
      const { mimeType, dataUrl } = await attachmentDataUrl(ctx.storage, attachment);
      return { fileName: attachment.name, mimeType, dataUrl };
    }

    return { content: "" };
  },
});
