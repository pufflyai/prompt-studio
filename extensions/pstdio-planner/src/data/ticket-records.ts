import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { readTicketTags, type StoredTicketRecord, writeTicketTags } from "./ticket-tag-storage";
import type { StoredTicket } from "./types";

export const TICKETS_COLLECTION = "tickets";
export const ticketRecords = (storage: ExtensionStorageApi) => {
  const records = storage.collection<StoredTicketRecord>(TICKETS_COLLECTION);
  return {
    ...records,
    get: async (id: string) => {
      const stored = await records.get(id);
      return stored && readTicketTags(stored);
    },
    list: async () => (await records.list()).map(readTicketTags),
    read: async (id: string) => {
      const observed = await records.read(id);
      return observed && { ...observed, stored: observed.value, value: readTicketTags(observed.value) };
    },
    put: async (id: string, value: StoredTicket) => records.put(id, writeTicketTags(value, await records.get(id))),
    update: async (id: string, value: StoredTicket) =>
      records.update(id, writeTicketTags(value, await records.get(id))),
    updateIfUnchanged: async (id: string, revision: string, value: StoredTicket, stored?: StoredTicketRecord) =>
      records.updateIfUnchanged(id, revision, writeTicketTags(value, stored ?? (await records.get(id)))),
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
