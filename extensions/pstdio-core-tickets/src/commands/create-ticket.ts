import { defineCommand, params } from "@pstdio/sdk/extensions";
import { putTicket, ticketsCollection } from "../data/collections";
import { seedDefaultStatuses } from "../data/seed";

export const createTicketCommand = defineCommand({
  title: "Create ticket",
  params: {
    title: params.text(),
    content: params.longText(),
    statusId: params.text(),
    tagIds: params.json<string[]>(),
    parentId: params.text(),
  },
  async run(ctx) {
    const existing = await ticketsCollection(ctx.storage).list();
    const statuses = await seedDefaultStatuses(ctx.storage);
    const defaultStatus = statuses.find((status) => status.isDefault) ?? statuses[0];
    const now = new Date().toISOString();

    return putTicket(ctx.storage, {
      id: crypto.randomUUID(),
      shorthand: `T-${existing.length + 1}`,
      title: ctx.params.title ?? "Untitled",
      content: ctx.params.content ?? "",
      statusId: ctx.params.statusId ?? defaultStatus?.id ?? null,
      tagIds: ctx.params.tagIds ?? [],
      parentId: ctx.params.parentId ?? null,
      dependsOn: null,
      blockedReason: null,
      archived: false,
      sortOrder: existing.length,
      createdAt: now,
      updatedAt: now,
    });
  },
});
