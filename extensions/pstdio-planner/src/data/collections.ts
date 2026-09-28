import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import type { StoredStatus, StoredTag, StoredTicket } from "./types";

export const TICKETS_COLLECTION = "tickets";
export const STATUSES_COLLECTION = "ticket-statuses";
export const TAGS_COLLECTION = "ticket-tags";

const ticketWrites = new Map<string, Promise<unknown>>();

const withTicketWrite = async <T>(id: string, write: () => Promise<T>) => {
  const previous = ticketWrites.get(id) ?? Promise.resolve();
  const pending = previous.catch(() => {}).then(write);
  ticketWrites.set(id, pending);
  try {
    return await pending;
  } finally {
    if (ticketWrites.get(id) === pending) ticketWrites.delete(id);
  }
};

export const ticketsCollection = (storage: ExtensionStorageApi) => {
  const collection = storage.collection<StoredTicket>(TICKETS_COLLECTION);
  const write = (method: "put" | "update", id: string, ticket: StoredTicket) =>
    withTicketWrite(id, async () => {
      const existing = await collection.get(id);
      // Identity belongs to the allocator and migration, never to an editor's snapshot.
      await collection[method](id, { ...ticket, shorthand: existing?.shorthand ?? ticket.shorthand });
    });
  return {
    ...collection,
    put: (id: string, ticket: StoredTicket) => write("put", id, ticket),
    update: (id: string, ticket: StoredTicket) => write("update", id, ticket),
    delete: (id: string) => withTicketWrite(id, () => collection.delete(id)),
  };
};

export const migrateTicketShorthand = (storage: ExtensionStorageApi, id: string, shorthand: string) =>
  withTicketWrite(id, async () => {
    const collection = storage.collection<StoredTicket>(TICKETS_COLLECTION);
    const ticket = await collection.get(id);
    if (ticket) await collection.update(id, { ...ticket, shorthand });
  });

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
