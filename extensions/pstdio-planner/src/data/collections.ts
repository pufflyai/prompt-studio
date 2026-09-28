import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { identityGuardedTickets } from "../migrations/ticket-identities/identity-guard";
import type { StoredStatus, StoredTag, StoredTicket } from "./types";

export const TICKETS_COLLECTION = "tickets";
export const STATUSES_COLLECTION = "ticket-statuses";
export const TAGS_COLLECTION = "ticket-tags";

// Temporary ticket identity migration (ADR 0047). When it is removed, return
// `storage.collection<StoredTicket>(TICKETS_COLLECTION)` here again.
export const ticketsCollection = (storage: ExtensionStorageApi) => identityGuardedTickets(storage, TICKETS_COLLECTION);

export const statusesCollection = (storage: ExtensionStorageApi) =>
  storage.collection<StoredStatus>(STATUSES_COLLECTION);

export const tagsCollection = (storage: ExtensionStorageApi) => storage.collection<StoredTag>(TAGS_COLLECTION);

// The runtime's collection.create() stores the value *without* the generated id,
// so list()/get() would lose it. We own the id and persist it inside the value.
export const putTicket = async (storage: ExtensionStorageApi, ticket: StoredTicket) => {
  await ticketsCollection(storage).put(ticket.id, ticket);
  return ticket;
};

export const updateTicket = async (storage: ExtensionStorageApi, ticket: StoredTicket) => {
  await ticketsCollection(storage).update(ticket.id, ticket);
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
