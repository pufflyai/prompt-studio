import { defineCommand, params } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "../data/collections";

// Powers the markdown editor's save-on-edit autosave. Patches only the provided
// fields so a content save never clobbers the title and vice versa.
export const updateTicketCommand = defineCommand({
  title: "Update ticket",
  params: {
    id: params.text({ required: true }),
    content: params.longText(),
    title: params.text(),
    statusId: params.text(),
  },
  async run(ctx) {
    const collection = ticketsCollection(ctx.storage);
    const existing = await collection.get(ctx.params.id);
    if (!existing) return null;

    const next = {
      ...existing,
      ...(ctx.params.content !== undefined ? { content: ctx.params.content } : {}),
      ...(ctx.params.title !== undefined ? { title: ctx.params.title } : {}),
      ...(ctx.params.statusId !== undefined ? { statusId: ctx.params.statusId || null } : {}),
      updatedAt: new Date().toISOString(),
    };
    await collection.put(existing.id, next);
    return next;
  },
});
