import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { TICKET_KEY_PREFIX } from "./ticket-record-address";

/** The ticket ID a `ticketRecordId` address names, or undefined for other records. */
export const ticketIdOfRecord = (recordId: string) => {
  try {
    const key = (JSON.parse(recordId) as unknown[]).at(-1);
    return typeof key === "string" && key.startsWith(TICKET_KEY_PREFIX)
      ? key.slice(TICKET_KEY_PREFIX.length)
      : undefined;
  } catch {
    return undefined;
  }
};
const ticketIds = (recordIds: string[]) =>
  recordIds.map(ticketIdOfRecord).filter((id): id is string => id !== undefined);

/**
 * Tickets are records since storage version 5. The returned storage reports every ticket record it
 * reads and every ticket record a saved (not refused or stale) commit through it writes.
 */
export const observeTicketRecords = (storage: ExtensionStorageApi) => {
  const reads: string[] = [];
  const writes: string[] = [];
  const records = storage.records;
  const observed: ExtensionStorageApi = {
    ...storage,
    records: {
      ...records,
      read: async (recordId, ...rest) => {
        reads.push(...ticketIds([recordId]));
        return records.read(recordId, ...rest);
      },
      readMany: async (recordIds) => {
        reads.push(...ticketIds(recordIds));
        return records.readMany(recordIds);
      },
      commit: async (group) => {
        const outcome = await records.commit(group);
        if (outcome.state !== "refused") writes.push(...ticketIds(group.edits.map(({ recordId }) => recordId)));
        return outcome;
      },
      commitIfCurrent: async (group) => {
        const outcome = await records.commitIfCurrent(group);
        if (outcome && outcome.state !== "refused")
          writes.push(...ticketIds(group.edits.map(({ recordId }) => recordId)));
        return outcome;
      },
    },
  };
  return { storage: observed, reads, writes };
};

export const observeStorageReads = (storage: ExtensionStorageApi) => {
  const reads: string[] = [];
  // Report ticket record reads under the names their collection reads had.
  const ticketRead = (recordIds: string[]) => {
    for (const id of ticketIds(recordIds)) reads.push(`tickets/${id}`);
  };
  const observed: ExtensionStorageApi = {
    ...storage,
    records: {
      ...storage.records,
      read(recordId, ...rest) {
        ticketRead([recordId]);
        return storage.records.read(recordId, ...rest);
      },
      readMany(recordIds) {
        ticketRead(recordIds);
        return storage.records.readMany(recordIds);
      },
    },
    collection<T>(name: string) {
      const collection = storage.collection<T>(name);
      return {
        ...collection,
        async get(id: string) {
          reads.push(`${name}/${id}`);
          return collection.get(id);
        },
        async list() {
          reads.push(`${name}/*`);
          return collection.list();
        },
      };
    },
  };
  return { storage: observed, reads };
};
