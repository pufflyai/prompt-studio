import { defineCommand, eventRef, params } from "@pstdio/sdk/extensions";
import { tagsCollection, ticketsCollection } from "../data/collections";
import { ticketTagAttributeId } from "../data/mappers";

const selectedTagOptionIds = (value: string | string[] | undefined, tagOptionIds: Set<string>) => {
  if (Array.isArray(value)) return value.filter((id) => tagOptionIds.has(id));
  if (!value || !tagOptionIds.has(value)) return [];
  return [value];
};

// Other extensions subscribe to this to react when a human (or automation)
// moves a ticket between columns. The automations extension uses it to fire
// refinement the instant a ticket lands in the Refine column instead of
// waiting for the hourly cron tick.
export const ticketStatusChangedEvent = eventRef<{
  ticketId: string;
  shorthand: string;
  previousStatusId: string | null;
  statusId: string | null;
  changedAt: string;
}>("pstdio-planner.ticket-status-changed");

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
      const changedAt = new Date().toISOString();
      const next = { ...existing, statusId: statusId || null, updatedAt: changedAt };
      await collection.put(rowId, next);
      if (existing.statusId !== next.statusId) {
        await ctx.events.emit(ticketStatusChangedEvent, {
          ticketId: existing.id,
          shorthand: existing.shorthand,
          previousStatusId: existing.statusId ?? null,
          statusId: next.statusId ?? null,
          changedAt,
        });
      }
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
