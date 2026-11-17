// A single-select property holds one value per ticket. Planner reports conflicts and lets
// people choose; it never picks a value for them.
import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { seedDefaultTags } from "./seed";
import { publishTicketChanges } from "./ticket-activity";
import { type TicketContext, withTicketIdentities } from "./ticket-identity";
import { changeTicketRecord } from "./ticket-records";
import { inBatches, ticketKeyPages, ticketRecordPages, ticketTagSelection } from "./ticket-selection";
import { assertOneTagValue, tagValue, tagValueIds, ticketTagsFromIds, withTagValue } from "./ticket-tags";
import { queueTicketWrite } from "./ticket-write-queue";
import type { StoredTag, StoredTicket, StoredTicketTags } from "./types";

// Checks every stored ticket, including archived ones and drafts, before the type changes.
export const assertSingleSelectConversion = async (
  ctx: TicketContext,
  tag: StoredTag,
  nextType: StoredTag["type"] | undefined,
) => {
  if (nextType !== "single_select" || tag.type === "single_select") return;
  const optionIds = new Set(tag.options.map(({ id }) => id));
  for await (const page of ticketRecordPages(ctx.storage, ticketTagSelection(tag.id), "ticket-tags")) {
    const conflicts = page.filter(
      (ticket) => tagValueIds(ticket.tags?.[tag.id]).filter((id) => optionIds.has(id)).length > 1,
    );
    if (!conflicts.length) continue;
    const examples = await withTicketIdentities(ctx, conflicts.slice(0, 20));
    throw new Error(
      `${tag.name} has more than one value on ${examples.map(({ shorthand }) => shorthand).join(", ")}. ` +
        `Keep one ${tag.name} value on each of these tickets, then change ${tag.name} to single-select.`,
    );
  }
};

type TagValue = StoredTicketTags[string];

// A bulk tag change edits only this tag's value, on the latest copy of each ticket. Saving the
// listed tickets whole would undo an edit or sync that landed while the change ran. Each edit runs
// in the ticket's write queue, so it never writes back a file list that changeTicketFiles replaced.
export const editTicketTagValues = async (
  ctx: TicketContext,
  tagId: string,
  edit: (value: TagValue) => TagValue | undefined,
  preservedTags: StoredTag[] = [],
) => {
  for await (const page of ticketKeyPages(ctx.storage, ticketTagSelection(tagId), "ticket-tags")) {
    await inBatches(page, ({ fields }) =>
      queueTicketWrite(String(fields.id), async () => {
        let before: StoredTicket | undefined;
        const changed = await changeTicketRecord(ctx.storage, String(fields.id), (ticket) => {
          before = undefined;
          const value = ticket.tags?.[tagId];
          if (value === undefined) return ticket;
          const next = edit(value);
          if (JSON.stringify(next) === JSON.stringify(value)) return ticket;
          before = ticket;
          return { ...ticket, tags: withTagValue(ticket.tags, tagId, next), updatedAt: new Date().toISOString() };
        });
        if (before && changed) await publishTicketChanges(ctx, before, changed, preservedTags);
      }),
    );
  }
};

// Stores each ticket's value in the shape of the tag's current type.
export const convertTicketTagValues = (ctx: TicketContext, tag: StoredTag) =>
  editTicketTagValues(ctx, tag.id, (value) => tagValue(tag, tagValueIds(value), value));

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
