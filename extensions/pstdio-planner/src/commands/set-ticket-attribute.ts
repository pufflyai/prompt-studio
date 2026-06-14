import { defineCommand, params } from "@pstdio/sdk/extensions";
import { tagsCollection, ticketsCollection } from "../data/collections";
import { ticketTagAttributeId } from "../data/mappers";

const selectedTagOptionIds = (value: string | string[] | undefined, tagOptionIds: Set<string>) => {
  if (Array.isArray(value)) return value.filter((id) => tagOptionIds.has(id));
  if (!value || !tagOptionIds.has(value)) return [];
  return [value];
};

// Backs the board's inline attribute edits and drag-between-columns. The renderer
// sends the grouping attribute id + the target value: a statusId for status, a tag
// option id for single-select tags, or the next option-id array for multi-select tags.
export const setTicketAttributeCommand = defineCommand({
  title: "Set ticket attribute",
  params: {
    rowId: params.text({ required: true }),
    attributeId: params.text({ required: true }),
    value: params.json<string | string[]>(),
  },
  async run(ctx) {
    const { attributeId, rowId, value } = ctx.params;
    const collection = ticketsCollection(ctx.storage);
    const existing = await collection.get(rowId);
    if (!existing) return null;

    if (attributeId === "status") {
      const statusId = typeof value === "string" ? value : "";
      const next = { ...existing, statusId: statusId || null, updatedAt: new Date().toISOString() };
      await collection.put(rowId, next);
      return next;
    }

    const tag = (await tagsCollection(ctx.storage).list()).find(
      (candidate) => candidate.id === attributeId || ticketTagAttributeId(candidate) === attributeId,
    );
    if (!tag) return existing;

    const tagOptionIds = new Set(tag.options.map((option) => option.id));
    const others = (existing.tagIds ?? []).filter((id) => !tagOptionIds.has(id));
    const selected = selectedTagOptionIds(value, tagOptionIds);
    const next = {
      ...existing,
      tagIds: [...others, ...selected],
      updatedAt: new Date().toISOString(),
    };
    await collection.put(rowId, next);
    return next;
  },
});
