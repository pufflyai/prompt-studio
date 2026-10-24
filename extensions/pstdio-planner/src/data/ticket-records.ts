import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { ticketTagsFromIds } from "./ticket-tags";
import type { StoredTag, StoredTicket } from "./types";

export const TICKETS_COLLECTION = "tickets";
export const TAGS_COLLECTION = "ticket-tags";

type LegacyTicketRecord = StoredTicket & { tagIds?: string[] };

// Builds before 0.46 stored every tag option in one `tagIds` list. A device on such a build can
// sync a ticket in that shape at any time, so every read converts it. The result depends only on
// stored data, so all devices show the same tags, and the next save stores only `tags`.
const withStoredTags = async (storage: ExtensionStorageApi, records: LegacyTicketRecord[]) => {
  if (!records.some((record) => "tagIds" in record)) return records as StoredTicket[];
  const tags = await storage.collection<StoredTag>(TAGS_COLLECTION).list();
  return records.map((record): StoredTicket => {
    if (!("tagIds" in record)) return record;
    const { tagIds, ...ticket } = record;
    // `tags` can only come from a newer build, so it wins for each tag it holds.
    return { ...ticket, tags: { ...ticketTagsFromIds(tags, tagIds ?? []), ...ticket.tags } };
  });
};

export const ticketRecords = (storage: ExtensionStorageApi) => {
  const records = storage.collection<StoredTicket>(TICKETS_COLLECTION);
  return {
    get: async (id: string) => {
      const record = await records.get(id);
      return record ? (await withStoredTags(storage, [record]))[0] : undefined;
    },
    list: async () => withStoredTags(storage, await records.list()),
    put: (id: string, ticket: StoredTicket) => records.put(id, ticketRecord(ticket)),
    update: (id: string, ticket: StoredTicket) => records.update(id, ticketRecord(ticket)),
    delete: (id: string) => records.delete(id),
  };
};

// Presentation fields can arrive from a query or an older record. Core owns the ticket number,
// and commands return flat `tagIds` that records store as `tags`.
const ticketRecord = (ticket: StoredTicket) => {
  const {
    shorthand: _shorthand,
    aliases: _aliases,
    tagIds: _tagIds,
    ...record
  } = ticket as StoredTicket & {
    shorthand?: string;
    aliases?: string[];
    tagIds?: string[];
  };
  return record;
};
