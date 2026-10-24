import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { TICKETS_COLLECTION } from "./collections";
import { seedDefaultTags } from "./seed";
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
    await tickets.put(ticket.id, { ...ticket, tags: ticketTagsFromIds(tags, tagIds ?? []) });
  }
};
