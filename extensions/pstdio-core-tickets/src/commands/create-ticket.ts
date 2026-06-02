import { defineCommand, params } from "@pstdio/sdk/extensions";
import { putTicket, ticketsCollection } from "../data/collections";
import { seedDefaultStatuses } from "../data/seed";
import type { StoredTicketAttachment } from "../data/types";

const getTicketNumber = (shorthand: string) => {
  const match = /^T-(\d+)$/.exec(shorthand);
  return match ? Number(match[1]) : 0;
};

export const createTicketCommand = defineCommand({
  title: "Create ticket",
  params: {
    title: params.text(),
    content: params.longText(),
    statusId: params.text(),
    tagIds: params.json<string[]>(),
    attachments: params.json<StoredTicketAttachment[]>(),
    parentId: params.text(),
  },
  async run(ctx) {
    const existing = await ticketsCollection(ctx.storage).list();
    const statuses = await seedDefaultStatuses(ctx.storage);
    const defaultStatus = statuses.find((status) => status.isDefault) ?? statuses[0];
    const now = new Date().toISOString();
    const ticketNumber = Math.max(0, ...existing.map((ticket) => getTicketNumber(ticket.shorthand))) + 1;
    const sortOrder = Math.max(-1, ...existing.map((ticket) => ticket.sortOrder)) + 1;

    return putTicket(ctx.storage, {
      id: crypto.randomUUID(),
      shorthand: `T-${ticketNumber}`,
      title: ctx.params.title ?? "Untitled",
      content: ctx.params.content ?? "",
      statusId: ctx.params.statusId ?? defaultStatus?.id ?? null,
      tagIds: ctx.params.tagIds ?? [],
      attachments: ctx.params.attachments ?? [],
      parentId: ctx.params.parentId ?? null,
      dependsOn: null,
      blockedReason: null,
      archived: false,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    });
  },
});
