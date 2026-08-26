import { defineCommand, params } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "../data/collections";
import type { StoredTicketAttachment } from "../data/types";
import { plannerTicketsChanged } from "../events";

export const attachTicketFileCommand = defineCommand({
  id: "attach-file",
  title: "Attach file",
  params: {
    ticketId: params.text({ required: true }),
    ref: params.json<StoredTicketAttachment, { required: true }>({ required: true }),
  },
  async run(ctx, commandParams) {
    const collection = ticketsCollection(ctx.storage);
    const existing = await collection.get(commandParams.ticketId);
    if (!existing) return null;

    const next = {
      ...existing,
      attachments: [
        ...(existing.attachments ?? []).filter((attachment) => attachment.id !== commandParams.ref.id),
        commandParams.ref,
      ],
      updatedAt: new Date().toISOString(),
    };
    await collection.put(existing.id, next);
    await ctx.events.emit(plannerTicketsChanged, { ticketId: existing.id });
    return next;
  },
});

export const detachTicketFileCommand = defineCommand({
  id: "detach-file",
  title: "Detach file",
  params: {
    ticketId: params.text({ required: true }),
    fileId: params.text({ required: true }),
  },
  async run(ctx, commandParams) {
    const collection = ticketsCollection(ctx.storage);
    const existing = await collection.get(commandParams.ticketId);
    if (!existing) return null;

    const next = {
      ...existing,
      attachments: (existing.attachments ?? []).filter((attachment) => attachment.id !== commandParams.fileId),
      updatedAt: new Date().toISOString(),
    };
    await collection.put(existing.id, next);
    await ctx.events.emit(plannerTicketsChanged, { ticketId: existing.id });
    return next;
  },
});
