import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import type { StoredTicket } from "./types";

export const TICKETS_COLLECTION = "tickets";
export const ticketRecords = (storage: ExtensionStorageApi) => storage.collection<StoredTicket>(TICKETS_COLLECTION);

// Reads add the number fields from core, so saves drop them. Commands return flat `tagIds`;
// records store `tags`.
export const ticketRecord = (ticket: StoredTicket) => {
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
