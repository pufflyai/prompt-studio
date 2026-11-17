import type { ExtensionStorageApi, StorageRecord } from "@pstdio/sdk/extensions";
import type { StoredTicketRecord } from "./ticket-tag-storage";

/** The deprecated collection tickets lived in until storage version 5 moved them to records. */
export const TICKETS_COLLECTION = "tickets";
/** Each ticket is the record `records.id(TICKET_KEY_PREFIX + ticketId)`. */
export const TICKET_KEY_PREFIX = "ticket:";
export const ticketRecordId = (storage: ExtensionStorageApi, id: string) =>
  storage.records.id(`${TICKET_KEY_PREFIX}${id}`);

export const liveRecord = (record: StorageRecord) => record.exists && !record.deleted;

/** Read up to 100 tickets by record address, in request order. */
export const readTicketRows = async (storage: ExtensionStorageApi, recordIds: string[]) =>
  (await storage.records.readMany(recordIds)).map((record) =>
    liveRecord(record) ? (record.value as unknown as StoredTicketRecord) : undefined,
  );
