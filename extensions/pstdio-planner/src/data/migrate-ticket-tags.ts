import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { seedDefaultTags } from "./seed";
import { TICKETS_COLLECTION, ticketRecord } from "./ticket-records";
import { ticketTagsFromIds } from "./ticket-tags";
import type { StoredTicket } from "./types";

type TicketWithTagIds = StoredTicket & { tagIds?: string[] };

// Earlier tickets kept every tag option in one `tagIds` list, so two devices that each chose a
// different single-select value kept both. The result depends only on stored data, so every
// device that runs this upgrade writes the same tags.
export const migrateTicketTags = async (storage: ExtensionStorageApi) => {
  const tags = await seedDefaultTags(storage);
  const tickets = storage.collection<TicketWithTagIds>(TICKETS_COLLECTION);
  for (const listed of await tickets.list()) {
    if (!("tagIds" in listed)) continue;
    // Re-read right before writing: the list can be older than an edit made since.
    const current = await tickets.get(listed.id);
    if (!current || !("tagIds" in current)) continue;
    const { tagIds, ...ticket } = current;
    // `tags` can only come from a newer edit that ran before this upgrade, so it wins.
    const next = { ...ticket, tags: { ...ticketTagsFromIds(tags, tagIds ?? []), ...ticket.tags } };
    await tickets.put(ticket.id, ticketRecord(next));
  }
};
