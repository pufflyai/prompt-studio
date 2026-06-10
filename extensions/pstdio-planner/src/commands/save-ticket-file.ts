import { defineCommand, params } from "@pstdio/sdk/extensions";
import { updateTicketFile } from "../data/file-operations";
import { parseTicketFileResourceId } from "../data/ticket-file-ref";

// Save command for the ticket-file renderer. Only editable text files reach here
// (the host marks image attachments read-only and never calls save).
export const saveTicketFileCommand = defineCommand({
  title: "Save ticket file",
  params: { id: params.text(), content: params.longText({ required: true }) },
  async run(ctx) {
    const raw = ctx.params.id ?? (ctx.resource?.type === "ticket-file" ? ctx.resource.id : undefined);
    const parsed = parseTicketFileResourceId(raw);
    if (!parsed) return null;

    return updateTicketFile({
      storage: ctx.storage,
      ticketId: parsed.ticketId,
      fileId: parsed.entryId,
      content: ctx.params.content,
    });
  },
});
