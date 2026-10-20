// A single-select property holds at most one value per ticket. Planner reports conflicts and lets
// people choose; it never picks a value for them.
import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "./collections";
import { isSingleSelectTicketTag } from "./mappers";
import { seedDefaultTags } from "./seed";
import type { TicketContext } from "./ticket-identity";
import type { StoredTag } from "./types";

const selectedOptions = (tag: Pick<StoredTag, "options">, tagIds: readonly string[] = []) => {
  const optionIds = new Set(tag.options.map(({ id }) => id));
  return tagIds.filter((id) => optionIds.has(id));
};

// Checks every stored ticket, including archived ones and drafts, before the type changes.
export const assertSingleSelectConversion = async (
  ctx: TicketContext,
  tag: StoredTag,
  nextType: StoredTag["type"] | undefined,
) => {
  if (nextType !== "single_select" || tag.type === "single_select") return;
  const conflicts = (await ticketsCollection(ctx).list()).filter(
    (ticket) => selectedOptions(tag, ticket.tagIds).length > 1,
  );
  if (conflicts.length === 0) return;
  throw new Error(
    `${tag.name} has more than one value on ${conflicts.map(({ shorthand }) => shorthand).join(", ")}. ` +
      `Keep one ${tag.name} value on each of these tickets, then change ${tag.name} to single-select.`,
  );
};

// A write may keep or shrink a conflict stored before the property became single-select, so the
// ticket stays editable, but it cannot add a value to it.
export const assertSingleSelectTagIds = async (
  storage: ExtensionStorageApi,
  nextTagIds: readonly string[],
  previousTagIds: readonly string[] = [],
) => {
  for (const tag of await seedDefaultTags(storage)) {
    if (!isSingleSelectTicketTag(tag)) continue;
    const next = selectedOptions(tag, nextTagIds);
    const previous = selectedOptions(tag, previousTagIds);
    if (next.length < 2 || next.every((id) => previous.includes(id))) continue;
    const names = tag.options.filter(({ id }) => next.includes(id)).map(({ name }) => name);
    throw new Error(`${tag.name} allows one value. Choose one of: ${names.join(", ")}.`);
  }
};
