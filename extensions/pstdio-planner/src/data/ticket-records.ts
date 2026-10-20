import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import type { StoredTicket } from "./types";

export const TICKETS_COLLECTION = "tickets";
export const ticketRecords = (storage: ExtensionStorageApi) => storage.collection<StoredTicket>(TICKETS_COLLECTION);

// Presentation fields can arrive from a query or an older record. Core owns them.
export const ticketRecord = (ticket: StoredTicket) => {
  const {
    shorthand: _shorthand,
    aliases: _aliases,
    ...record
  } = ticket as StoredTicket & {
    shorthand?: string;
    aliases?: string[];
  };
  return record;
};
