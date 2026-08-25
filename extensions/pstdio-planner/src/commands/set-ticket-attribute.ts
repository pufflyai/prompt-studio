import { defineCommand, type ExtensionContextBase, type ExtensionStorageApi, params } from "@pstdio/sdk/extensions";
import { tagsCollection, ticketsCollection } from "../data/collections";
import { ticketTagAttributeId } from "../data/mappers";
import { plannerTicketsChanged } from "../events";

const selectedTagOptionIds = (value: string | string[] | undefined, tagOptionIds: Set<string>) => {
  if (Array.isArray(value)) return value.filter((id) => tagOptionIds.has(id));
  if (!value || !tagOptionIds.has(value)) return [];
  return [value];
};

// Applies a single attribute change to a ticket. The attribute id + value follow the
// grouping/renderer convention: a statusId for status, a tag option id for single-select
// tags, or the next option-id array for multi-select tags. Shared by the board's inline
// edits and the ticket properties controls panel.
export const applyTicketAttribute = async (input: {
  storage: ExtensionStorageApi;
  rowId: string;
  attributeId: string;
  value: string | string[] | undefined;
}) => {
  const { storage, rowId, attributeId, value } = input;
  const collection = ticketsCollection(storage);
  const existing = await collection.get(rowId);
  if (!existing) return null;

  if (attributeId === "status") {
    const statusId = typeof value === "string" ? value : "";
    const next = { ...existing, statusId: statusId || null, updatedAt: new Date().toISOString() };
    await collection.put(rowId, next);
    return next;
  }

  const tag = (await tagsCollection(storage).list()).find(
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
};

export const setTicketAttribute = async (
  ctx: Pick<ExtensionContextBase, "events" | "storage">,
  input: { rowId: string; attributeId: string; value?: unknown },
) => {
  const value =
    typeof input.value === "string" ||
    (Array.isArray(input.value) && input.value.every((item) => typeof item === "string"))
      ? input.value
      : undefined;
  const ticket = await applyTicketAttribute({
    storage: ctx.storage,
    rowId: input.rowId,
    attributeId: input.attributeId,
    value,
  });
  if (ticket) await ctx.events.emit(plannerTicketsChanged, { ticketId: ticket.id });
  return ticket;
};

// Backs the board's inline attribute edits and drag-between-columns.
export const setTicketAttributeCommand = defineCommand({
  title: "Set ticket attribute",
  params: {
    rowId: params.text({ required: true }),
    attributeId: params.text({ required: true }),
    value: params.json<string | string[]>(),
  },
  run: setTicketAttribute,
});
