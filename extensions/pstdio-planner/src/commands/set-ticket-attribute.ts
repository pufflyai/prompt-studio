import { defineCommand, params } from "@pstdio/sdk/extensions";
import { tagsCollection, ticketsCollection } from "../data/collections";

// Backs the board's inline attribute edits and drag-between-columns. The renderer
// sends the grouping attribute id + the target column value (a statusId for the
// status attribute, a tag option id for a single-select tag attribute, "" to clear).
export const setTicketAttributeCommand = defineCommand({
  title: "Set ticket attribute",
  params: {
    rowId: params.text({ required: true }),
    attributeId: params.text({ required: true }),
    value: params.text(),
  },
  async run(ctx) {
    const { attributeId, rowId, value } = ctx.params;
    const collection = ticketsCollection(ctx.storage);
    const existing = await collection.get(rowId);
    if (!existing) return null;

    if (attributeId === "status") {
      const next = { ...existing, statusId: value || null, updatedAt: new Date().toISOString() };
      await collection.put(rowId, next);
      return next;
    }

    const tag = (await tagsCollection(ctx.storage).list()).find((candidate) => candidate.id === attributeId);
    if (!tag) return existing;

    const tagOptionIds = new Set(tag.options.map((option) => option.id));
    const others = (existing.tagIds ?? []).filter((id) => !tagOptionIds.has(id));
    const next = {
      ...existing,
      tagIds: value ? [...others, value] : others,
      updatedAt: new Date().toISOString(),
    };
    await collection.put(rowId, next);
    return next;
  },
});
