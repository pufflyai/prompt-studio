import { defineCommand, params } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "../data/collections";
import { deriveTitle } from "../utils/derive-title";

// Powers the markdown editor's save-on-edit autosave. The ticket title is the
// start of the body, so a content save re-derives the title to keep the board
// card and breadcrumb in sync.
export const updateTicketCommand = defineCommand({
  title: "Update ticket",
  params: {
    id: params.text({ required: true }),
    content: params.longText(),
    statusId: params.text(),
  },
  async run(ctx) {
    const collection = ticketsCollection(ctx.storage);
    const existing = await collection.get(ctx.params.id);
    if (!existing) return null;

    const next = {
      ...existing,
      ...(ctx.params.content !== undefined
        ? { content: ctx.params.content, title: deriveTitle(ctx.params.content) }
        : {}),
      ...(ctx.params.statusId !== undefined ? { statusId: ctx.params.statusId || null } : {}),
      updatedAt: new Date().toISOString(),
    };
    await collection.put(existing.id, next);
    return next;
  },
});
