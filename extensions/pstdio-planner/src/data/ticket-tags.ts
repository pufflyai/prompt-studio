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

// A list that a type change on another device left on a single-select stays editable: a write
// may keep or shrink it, but not add a value.
export const assertOneTagValue = (tag: StoredTag, optionIds: readonly string[], previous?: TagValue) => {
  if (!isSingleSelectTicketTag(tag)) return;
  const selected = tag.options.filter(({ id }) => optionIds.includes(id));
  const stored = tagValueIds(previous);
  if (selected.length < 2 || selected.every(({ id }) => stored.includes(id))) return;
  throw new Error(`${tag.name} allows one value. Choose one of: ${selected.map(({ name }) => name).join(", ")}.`);
};

// A single-select keeps the first selected option in option order, so every device keeps the
// same one. A multi-select keeps its existing items in place, so a save adds and removes only
// the items that changed. An emptied list stays, so another device's additions still merge in.
export const tagValue = (tag: StoredTag, selected: readonly string[], previous?: TagValue) => {
  if (isSingleSelectTicketTag(tag)) return sortedBySortOrder(tag.options).find(({ id }) => selected.includes(id))?.id;
  if (selected.length === 0 && previous === undefined) return undefined;
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
 * that belong to no tag are dropped.
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
