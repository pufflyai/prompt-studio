import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { tagsCollection } from "./collections";
import { ticketTagAttributeId } from "./mappers";
import { assertSingleSelectTagIds } from "./tag-cardinality";
import type { StoredTicket } from "./types";

const selectedTagOptions = (value: unknown, options: Set<string>) => {
  if (Array.isArray(value)) return value.filter((id): id is string => typeof id === "string" && options.has(id));
  if (typeof value === "string" && options.has(value)) return [value];
  return [];
};

/** Validate the complete edit before storing any of its values. */
export const ticketWithAttributes = async (
  storage: ExtensionStorageApi,
  ticket: StoredTicket,
  attributes: Record<string, unknown>,
) => {
  let statusId = ticket.statusId;
  let tagIds = ticket.tagIds ?? [];
  const tags = Object.keys(attributes).some((id) => id !== "status") ? await tagsCollection(storage).list() : [];
  for (const [attributeId, value] of Object.entries(attributes)) {
    if (attributeId === "status") {
      statusId = typeof value === "string" && value ? value : null;
      continue;
    }
    const tag = tags.find((tag) => tag.id === attributeId || ticketTagAttributeId(tag) === attributeId);
    if (!tag) continue;
    const options = new Set(tag.options.map(({ id }) => id));
    const selected = selectedTagOptions(value, options);
    tagIds = [...tagIds.filter((id) => !options.has(id)), ...selected];
  }
  const tagsChanged =
    tagIds.length !== (ticket.tagIds ?? []).length || tagIds.some((id) => !ticket.tagIds?.includes(id));
  if (!tagsChanged && statusId === ticket.statusId) return ticket;
  if (tagsChanged) await assertSingleSelectTagIds(storage, tagIds, ticket.tagIds);
  return { ...ticket, statusId, ...(tagsChanged ? { tagIds } : {}) };
};
