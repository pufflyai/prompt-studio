import { defineCommand, params } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "../data/collections";

// btoa expects a binary string (one char per byte). Build it byte-by-byte so a
// large image never blows the call stack the way String.fromCharCode(...bytes) would.
const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

// The webview iframe is sandboxed without allow-same-origin, so the attachment's
// host URL can't be loaded directly (and the testbench's blob URLs aren't
// network-loadable either). Return a data URL the <img> can render in any origin.
export const readTicketAttachmentCommand = defineCommand({
  title: "Read ticket attachment",
  params: {
    ticketId: params.text({ required: true }),
    attachmentId: params.text({ required: true }),
  },
  async run(ctx) {
    const ticket = await ticketsCollection(ctx.storage).get(ctx.params.ticketId);
    const attachment = ticket?.attachments?.find((entry) => entry.id === ctx.params.attachmentId);
    if (!attachment) return null;

    const bytes = await ctx.storage.files.getBytes(attachment.id);
    const mimeType = attachment.mimeType ?? "application/octet-stream";
    return { dataUrl: `data:${mimeType};base64,${toBase64(bytes)}` };
  },
});
