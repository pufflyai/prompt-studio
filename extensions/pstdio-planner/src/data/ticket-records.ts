import type { ExtensionStorageApi, StorageRecord } from "@pstdio/sdk/extensions";

export { TICKET_KEY_PREFIX, TICKETS_COLLECTION, ticketRecordId } from "./ticket-record-address";

import { migratePlannerStorage } from "./migrate-storage";
import { liveRecord, ticketRecordId } from "./ticket-record-address";
import { readTicketTags, type StoredTicketRecord, writeTicketTags } from "./ticket-tag-storage";
import type { StoredTicket } from "./types";

const live = liveRecord;
// Like the collection writes before, saved JSON drops undefined fields.
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as never;

// One attempt: a live ticket saves only while unchanged; a missing or deleted one is created on the
// condition that it is still missing. False means another write won and the caller reads again.
const saveOnce = async (
  storage: ExtensionStorageApi,
  id: string,
  value: StoredTicket,
  record: StorageRecord,
  stored: StoredTicketRecord | undefined,
) => {
  const recordId = ticketRecordId(storage, id);
  const replace = json(writeTicketTags(value, stored));
  if (stored) {
    const saved = await storage.records.commitIfCurrent({
      operationId: storage.ids.create(),
      edits: [{ recordId, expectedRevision: record.revision, replace }],
    });
    return !!saved && saved.state !== "refused";
  }
  const created = await storage.records.commit({
    operationId: storage.ids.create(),
    edits: [{ recordId, expectedRevision: record.revision, replace, ...(record.deleted ? { deleted: false } : {}) }],
  });
  return created.state !== "refused";
};

export const ticketRecords = (storage: ExtensionStorageApi) => {
  // Reads must not see the records before an older project's tickets have moved into them.
  const observe = async (id: string) => {
    await migratePlannerStorage({ storage });
    const record = await storage.records.read(ticketRecordId(storage, id));
    return { record, stored: live(record) ? (record.value as unknown as StoredTicketRecord) : undefined };
  };
  // Like the collection writes before, a save keeps the observed lifetime: a ticket another
  // device deleted is not brought back, and a stale read is read again before saving.
  const save = async (id: string, value: StoredTicket, requireLive: boolean) => {
    let seenLive = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      const { record, stored } = await observe(id);
      if (requireLive && !stored) throw new Error(`Item not found: ${id}`);
      // Deleted while this save retried: the delete wins, as it did for the collection before.
      if (seenLive && !stored) return;
      seenLive ||= !!stored;
      if (await saveOnce(storage, id, value, record, stored)) return;
    }
    throw new Error(`Ticket ${id} kept changing while saving`);
  };
  return {
    get: async (id: string) => {
      const { stored } = await observe(id);
      return stored && readTicketTags(stored);
    },
    read: async (id: string) => {
      const { record, stored } = await observe(id);
      return stored && { revision: record.revision, stored, value: readTicketTags(stored) };
    },
    put: (id: string, value: StoredTicket) => save(id, value, false),
    update: (id: string, value: StoredTicket) => save(id, value, true),
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
      for (let attempt = 0; attempt < 5; attempt++) {
        const { record, stored } = await observe(id);
        if (!stored) return;
        const outcome = await storage.records.commitIfCurrent({
          operationId: storage.ids.create(),
          edits: [{ recordId: ticketRecordId(storage, id), expectedRevision: record.revision, deleted: true }],
        });
        if (!outcome) continue;
        if (outcome.state === "refused" || outcome.state === "needs-attention")
          throw new Error(outcome.reason ?? "Ticket deletion was refused");
        return;
      }
      throw new Error(`Ticket ${id} kept changing while deleting`);
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
  // Revision conflicts retry; a refusal that keeps repeating, such as an oversized edit, ends.
  for (let attempt = 0; ; attempt++) {
    if (attempt === 20) throw new Error(`Ticket ${id} could not be saved: the save was refused repeatedly`);
    const observed = await records.read(id);
    if (!observed) return undefined;
    const next = await change(observed.value);
    if (next === observed.value) return next;
    if (await records.updateIfUnchanged(id, observed.revision, ticketRecord(next), observed.stored)) return next;
  }
};
