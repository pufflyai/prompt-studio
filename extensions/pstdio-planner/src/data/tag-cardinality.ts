// A single-select property holds one value per ticket. Planner reports conflicts and lets
// people choose; it never picks a value for them.
import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "./collections";
import { seedDefaultTags } from "./seed";
import type { TicketContext } from "./ticket-identity";
import { ticketRecords } from "./ticket-records";
import { assertOneTagValue, tagValue, tagValueIds, ticketTagsFromIds, withTagValue } from "./ticket-tags";
import { queueTicketWrite } from "./ticket-write-queue";
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

type TagValue = StoredTicketTags[string];

// A bulk tag change edits only this tag's value, on the latest copy of each ticket. Saving the
// listed tickets whole would undo an edit or sync that landed while the change ran. Each edit runs
// in the ticket's write queue, so it never writes back a file list that changeTicketFiles replaced.
export const editTicketTagValues = async (
  storage: ExtensionStorageApi,
  tagId: string,
  edit: (value: TagValue) => TagValue | undefined,
) => {
  const records = ticketRecords(storage);
  for (const listed of await records.list()) {
    if (listed.tags?.[tagId] === undefined) continue;
    await queueTicketWrite(listed.id, async () => {
      const ticket = await records.get(listed.id);
      const value = ticket?.tags?.[tagId];
      if (!ticket || value === undefined) return;
      const next = edit(value);
      if (JSON.stringify(next) === JSON.stringify(value)) return;
      await records.put(ticket.id, { ...ticket, tags: withTagValue(ticket.tags, tagId, next) });
    });
  }
};

// Stores each ticket's value in the shape of the tag's current type.
export const convertTicketTagValues = (storage: ExtensionStorageApi, tag: StoredTag) =>
  editTicketTagValues(storage, tag.id, (value) => tagValue(tag, tagValueIds(value), value));

/** Validate the flat `tagIds` a command received and translate them to the stored object. */
export const ticketTagsForIds = async (
  storage: ExtensionStorageApi,
  tagIds: readonly string[],
  previous?: StoredTicketTags,
) => {
  const tags = await seedDefaultTags(storage);
  for (const tag of tags) assertOneTagValue(tag, tagIds, previous?.[tag.id]);
  return ticketTagsFromIds(tags, tagIds, previous);
};
