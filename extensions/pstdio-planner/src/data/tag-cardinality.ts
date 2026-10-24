// A single-select property holds one value per ticket. Planner reports conflicts and lets
// people choose. Only the storage upgrade picks a value, by option order.
import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { putTicket, ticketsCollection } from "./collections";
import { seedDefaultTags } from "./seed";
import type { TicketContext } from "./ticket-identity";
import {
  assertOneTagValue,
  sameTicketTags,
  tagValue,
  tagValueIds,
  ticketTagsFromIds,
  withTagValue,
} from "./ticket-tags";
import type { StoredTag, StoredTicketTags } from "./types";

// Checks every stored ticket, including archived ones and drafts, before the type changes.
export const assertSingleSelectConversion = async (
  ctx: TicketContext,
  tag: StoredTag,
  nextType: StoredTag["type"] | undefined,
) => {
  if (nextType !== "single_select" || tag.type === "single_select") return;
  const optionIds = new Set(tag.options.map(({ id }) => id));
  const conflicts = (await ticketsCollection(ctx).list()).filter(
    (ticket) => tagValueIds(ticket.tags?.[tag.id]).filter((id) => optionIds.has(id)).length > 1,
  );
  if (conflicts.length === 0) return;
  throw new Error(
    `${tag.name} has more than one value on ${conflicts.map(({ shorthand }) => shorthand).join(", ")}. ` +
      `Keep one ${tag.name} value on each of these tickets, then change ${tag.name} to single-select.`,
  );
};

// Stores each ticket's value in the shape of the tag's current type.
export const convertTicketTagValues = async (ctx: TicketContext, tag: StoredTag) => {
  for (const ticket of await ticketsCollection(ctx).list()) {
    const value = ticket.tags?.[tag.id];
    if (value === undefined) continue;
    const tags = withTagValue(ticket.tags, tag.id, tagValue(tag, tagValueIds(value), value));
    if (!sameTicketTags(tags, ticket.tags)) await putTicket(ctx, { ...ticket, tags });
  }
};

/** Validate the flat `tagIds` a command received and translate them to the stored object. */
export const ticketTagsForIds = async (
  storage: ExtensionStorageApi,
  tagIds: readonly string[],
  previous?: StoredTicketTags,
) => {
  const tags = await seedDefaultTags(storage);
  for (const tag of tags) assertOneTagValue(tag, tagIds);
  return ticketTagsFromIds(tags, tagIds, previous);
};
