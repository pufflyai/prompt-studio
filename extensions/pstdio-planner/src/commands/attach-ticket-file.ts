import { defineCommand, params } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "../data/collections";
import type { StoredTicketAttachment } from "../data/types";

export const attachTicketFileCommand = defineCommand({
  title: "Attach file",
  params: {
    ticketId: params.text({ required: true }),
    ref: params.json<StoredTicketAttachment, { required: true }>({ required: true }),
  },
  async run(ctx) {
    const collection = ticketsCollection(ctx.storage);
    const existing = await collection.get(ctx.params.ticketId);
    if (!existing) return null;

    const next = {
      ...existing,
      attachments: [
        ...(existing.attachments ?? []).filter((attachment) => attachment.id !== ctx.params.ref.id),
        ctx.params.ref,
      ],
      updatedAt: new Date().toISOString(),
    };
    await collection.put(existing.id, next);
    return next;
  },
});

export const detachTicketFileCommand = defineCommand({
  title: "Detach file",
  params: {
    ticketId: params.text({ required: true }),
    fileId: params.text({ required: true }),
  },
  async run(ctx) {
    const collection = ticketsCollection(ctx.storage);
    const existing = await collection.get(ctx.params.ticketId);
    if (!existing) return null;

    const next = {
      ...existing,
      attachments: (existing.attachments ?? []).filter((attachment) => attachment.id !== ctx.params.fileId),
      updatedAt: new Date().toISOString(),
    };
    await collection.put(existing.id, next);
    return next;
  },
});
