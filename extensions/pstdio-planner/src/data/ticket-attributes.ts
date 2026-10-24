import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { tagsCollection } from "./collections";
import { ticketTagAttributeId } from "./mappers";
import { assertOneTagValue, sameTicketTags, tagValue, withTagValue } from "./ticket-tags";
import type { Ticket } from "./types";

const selectedTagOptions = (value: unknown, options: Set<string>) => {
  if (Array.isArray(value)) return value.filter((id): id is string => typeof id === "string" && options.has(id));
  if (typeof value === "string" && options.has(value)) return [value];
  return [];
};

/** Validate the complete edit before storing any of its values. */
export const ticketWithAttributes = async (
  storage: ExtensionStorageApi,
  ticket: Ticket,
  attributes: Record<string, unknown>,
) => {
  let statusId = ticket.statusId;
  let tags = ticket.tags ?? {};
  const tagDefinitions = Object.keys(attributes).some((id) => id !== "status")
    ? await tagsCollection(storage).list()
    : [];
  for (const [attributeId, value] of Object.entries(attributes)) {
    if (attributeId === "status") {
      statusId = typeof value === "string" && value ? value : null;
      continue;
    }
    const tag = tagDefinitions.find((tag) => tag.id === attributeId || ticketTagAttributeId(tag) === attributeId);
    if (!tag) continue;
    const selected = selectedTagOptions(value, new Set(tag.options.map(({ id }) => id)));
    assertOneTagValue(tag, selected);
    // Only this tag's key changes, so an edit to another tag on another device still merges.
    tags = withTagValue(tags, tag.id, tagValue(tag, selected, tags[tag.id]));
  }
  const tagsChanged = !sameTicketTags(tags, ticket.tags);
  if (!tagsChanged && statusId === ticket.statusId) return ticket;
  return { ...ticket, statusId, ...(tagsChanged ? { tags } : {}) };
};
