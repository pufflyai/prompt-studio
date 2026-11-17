import type { ExtensionStorageApi, StorageRecord } from "@pstdio/sdk/extensions";

export { TICKET_KEY_PREFIX, TICKETS_COLLECTION, ticketRecordId } from "./ticket-record-address";

import { migratePlannerStorage } from "./migrate-storage";
import { liveRecord, ticketRecordId } from "./ticket-record-address";
import { ticketRecordPages } from "./ticket-selection";
import { readTicketTags, type StoredTicketRecord, writeTicketTags } from "./ticket-tag-storage";
import type { StoredTicket } from "./types";

const live = liveRecord;
// Like the collection writes before, saved JSON drops undefined fields.
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as never;

export const ticketRecords = (storage: ExtensionStorageApi) => {
  // Reads must not see the records before an older project's tickets have moved into them.
  const observe = async (id: string) => {
    await migratePlannerStorage({ storage });
    const record = await storage.records.read(ticketRecordId(storage, id));
    return { record, stored: live(record) ? (record.value as unknown as StoredTicketRecord) : undefined };
  };
  const save = async (id: string, value: StoredTicket, record: StorageRecord, stored?: StoredTicketRecord) => {
    const outcome = await storage.records.commit({
      operationId: storage.ids.create(),
      edits: [
        {
          recordId: ticketRecordId(storage, id),
          observedRevision: record.revision,
          replace: json(writeTicketTags(value, stored)),
          ...(record.deleted ? { deleted: false } : {}),
        },
      ],
    });
    return outcome.state !== "refused";
  };
  return {
    get: async (id: string) => {
      const { stored } = await observe(id);
      return stored && readTicketTags(stored);
    },
    list: async () => {
      await migratePlannerStorage({ storage });
      const tickets: StoredTicket[] = [];
      for await (const page of ticketRecordPages(storage)) tickets.push(...page);
      return tickets;
    },
    read: async (id: string) => {
      const { record, stored } = await observe(id);
      return stored && { revision: record.revision, stored, value: readTicketTags(stored) };
    },
    put: async (id: string, value: StoredTicket) => {
      const { record, stored } = await observe(id);
      await save(id, value, record, stored);
    },
    update: async (id: string, value: StoredTicket) => {
      const { record, stored } = await observe(id);
      if (!stored) throw new Error(`Item not found: ${id}`);
      await save(id, value, record, stored);
    },
    /** Saves only while the ticket still has the revision `read` returned; false for changed or deleted tickets. */
    updateIfUnchanged: async (id: string, revision: string, value: StoredTicket, stored?: StoredTicketRecord) => {
      const current = stored ?? (await observe(id)).stored;
      const saved = await storage.records.commitIfCurrent({
        operationId: storage.ids.create(),
        edits: [
          {
            recordId: ticketRecordId(storage, id),
            expectedRevision: revision,
            replace: json(writeTicketTags(value, current)),
          },
        ],
      });
      return saved !== null && saved.state !== "refused";
    },
    /** Creates the ticket unless a live one exists; relay order refuses a concurrent create of the same ID. */
    createIfAbsent: async (id: string, value: StoredTicket) => {
      const { record, stored } = await observe(id);
      if (stored) return false;
      const outcome = await storage.records.commit({
        operationId: storage.ids.create(),
        edits: [
          {
            recordId: ticketRecordId(storage, id),
            expectedRevision: record.revision,
            replace: json(value),
            ...(record.deleted ? { deleted: false } : {}),
          },
        ],
      });
      return outcome.state !== "refused";
    },
    delete: async (id: string) => {
      const { record, stored } = await observe(id);
      if (!stored) return;
      await storage.records.commit({
        operationId: storage.ids.create(),
        edits: [{ recordId: ticketRecordId(storage, id), expectedRevision: record.revision, deleted: true }],
      });
    },
  };
};

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

// Recompute the intended fields if a received edit wins between observation and save.
export const changeTicketRecord = async (
  storage: ExtensionStorageApi,
  id: string,
  change: (current: StoredTicket) => StoredTicket | Promise<StoredTicket>,
) => {
  const records = ticketRecords(storage);
  for (;;) {
    const observed = await records.read(id);
    if (!observed) return undefined;
    const next = await change(observed.value);
    if (next === observed.value) return next;
    if (await records.updateIfUnchanged(id, observed.revision, ticketRecord(next), observed.stored)) return next;
  }
};
