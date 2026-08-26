import { defineCommand, params } from "@pstdio/sdk/extensions";
import { attachmentDataUrl } from "../data/attachment-data-url";
import { ticketsCollection } from "../data/collections";

// Returns a data URL the <img> can render in any origin (the attachment's host /
// blob URL isn't loadable across origins).
export const readTicketAttachmentCommand = defineCommand({
  id: "read-ticket-attachment",
  title: "Read ticket attachment",
  params: {
    ticketId: params.text({ required: true }),
    attachmentId: params.text({ required: true }),
  },
  async run(ctx, commandParams) {
    const ticket = await ticketsCollection(ctx.storage).get(commandParams.ticketId);
    const attachment = ticket?.attachments?.find((entry) => entry.id === commandParams.attachmentId);
    if (!attachment) return null;

    const { dataUrl } = await attachmentDataUrl(ctx.storage, attachment);
    return { dataUrl };
  },
});
