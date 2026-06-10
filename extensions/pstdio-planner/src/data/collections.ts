import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import type { StoredStatus, StoredTag, StoredTicket } from "./types";

export const TICKETS_COLLECTION = "tickets";
export const STATUSES_COLLECTION = "ticket-statuses";
export const TAGS_COLLECTION = "ticket-tags";

export const ticketsCollection = (storage: ExtensionStorageApi) => storage.collection<StoredTicket>(TICKETS_COLLECTION);

export const statusesCollection = (storage: ExtensionStorageApi) =>
  storage.collection<StoredStatus>(STATUSES_COLLECTION);

export const tagsCollection = (storage: ExtensionStorageApi) => storage.collection<StoredTag>(TAGS_COLLECTION);

// The runtime's collection.create() stores the value *without* the generated id,
// so list()/get() would lose it. We own the id and persist it inside the value.
export const putTicket = async (storage: ExtensionStorageApi, ticket: StoredTicket) => {
  await ticketsCollection(storage).put(ticket.id, ticket);
  return ticket;
};

export const putStatus = async (storage: ExtensionStorageApi, status: StoredStatus) => {
  await statusesCollection(storage).put(status.id, status);
  return status;
};

export const putTag = async (storage: ExtensionStorageApi, tag: StoredTag) => {
  await tagsCollection(storage).put(tag.id, tag);
  return tag;
};

const ticketNumber = (shorthand: string) => {
  const match = /^[A-Z]+-(\d+)$/.exec(shorthand);
  return match ? Number(match[1]) : 0;
};

// Shorthand and sort order both continue past the current maximum so ids stay
// stable across hard deletes (board and CLI create paths share this).
export const allocateTicketIdentity = (projectShorthand: string, existing: StoredTicket[]) => ({
  shorthand: `${projectShorthand}-${Math.max(0, ...existing.map((ticket) => ticketNumber(ticket.shorthand))) + 1}`,
  sortOrder: Math.max(-1, ...existing.map((ticket) => ticket.sortOrder)) + 1,
});
