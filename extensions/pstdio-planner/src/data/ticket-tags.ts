import { sortedBySortOrder } from "../utils/sort";
import type { StoredTag, StoredTicket, StoredTicketTags } from "./types";

type TagValue = StoredTicketTags[string];

// Existing projects may have seeded the planner-owned Type tag before it became scalar.
export const isSingleSelectTicketTag = (tag: StoredTag) => tag.type === "single_select" || tag.id === "default-type";

// Readers accept both shapes: another device can change a tag between single- and multi-select
// while a ticket still holds the old shape.
export const tagValueIds = (value: TagValue | undefined) => {
  if (value === undefined) return [];
  return typeof value === "string" ? [value] : value;
};

export const ticketTagIds = (ticket: Pick<StoredTicket, "tags">) =>
  Object.values(ticket.tags ?? {}).flatMap(tagValueIds);

export const assertOneTagValue = (tag: StoredTag, optionIds: readonly string[]) => {
  if (!isSingleSelectTicketTag(tag)) return;
  const names = tag.options.filter(({ id }) => optionIds.includes(id)).map(({ name }) => name);
  if (names.length > 1) throw new Error(`${tag.name} allows one value. Choose one of: ${names.join(", ")}.`);
};

// A multi-select keeps its existing items in place, so a save adds and removes only the items
// that changed and merges with another device's edits to the same list.
export const tagValue = (tag: StoredTag, selected: readonly string[], previous?: TagValue) => {
  if (selected.length === 0) return undefined;
  if (isSingleSelectTicketTag(tag)) return selected[0];
  const kept = tagValueIds(previous).filter((id) => selected.includes(id));
  return [...kept, ...selected.filter((id) => !kept.includes(id))];
};

export const withTagValue = (tags: StoredTicketTags | undefined, tagId: string, value: TagValue | undefined) => {
  const { [tagId]: _previous, ...rest } = tags ?? {};
  return value === undefined ? rest : { ...rest, [tagId]: value };
};

export const sameTicketTags = (left: StoredTicketTags = {}, right: StoredTicketTags = {}) =>
  [...new Set([...Object.keys(left), ...Object.keys(right)])].every(
    (tagId) => JSON.stringify(left[tagId]) === JSON.stringify(right[tagId]),
  );

/**
 * Commands keep the flat `tagIds` surface and translate it to the stored object. Option IDs
 * that belong to no tag are dropped. When a single-select receives several values, the first in
 * the tag's option order wins, so every device keeps the same one.
 */
export const ticketTagsFromIds = (tags: StoredTag[], tagIds: readonly string[], previous: StoredTicketTags = {}) =>
  tags.reduce<StoredTicketTags>((next, tag) => {
    const selected = sortedBySortOrder(tag.options)
      .map(({ id }) => id)
      .filter((id) => tagIds.includes(id));
    return withTagValue(next, tag.id, tagValue(tag, selected, previous[tag.id]));
  }, {});

/** The public ticket shape: callers read and write flat `tagIds`. */
export const withTicketTagIds = <T extends Pick<StoredTicket, "tags">>(ticket: T) => {
  const { tags: _tags, ...rest } = ticket;
  return { ...rest, tagIds: ticketTagIds(ticket) };
};
