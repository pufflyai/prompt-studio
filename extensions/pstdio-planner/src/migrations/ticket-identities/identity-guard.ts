import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import type { StoredTicket } from "../../data/types";

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

// Ticket writes and migration renumbering share a per-ticket queue. Normal writes keep the
// stored shorthand, so an editor holding a snapshot from before migration cannot undo it.
export const identityGuardedTickets = (storage: ExtensionStorageApi, name: string) => {
  const collection = storage.collection<StoredTicket>(name);
  const write = (method: "put" | "update", id: string, ticket: StoredTicket) =>
    withTicketWrite(id, async () => {
      const existing = await collection.get(id);
      await collection[method](id, { ...ticket, shorthand: existing?.shorthand ?? ticket.shorthand });
    });
  return {
    ...collection,
    put: (id: string, ticket: StoredTicket) => write("put", id, ticket),
    update: (id: string, ticket: StoredTicket) => write("update", id, ticket),
    delete: (id: string) => withTicketWrite(id, () => collection.delete(id)),
  };
};

export const migrateTicketShorthand = (storage: ExtensionStorageApi, name: string, id: string, shorthand: string) =>
  withTicketWrite(id, async () => {
    const collection = storage.collection<StoredTicket>(name);
    const ticket = await collection.get(id);
    if (ticket) await collection.update(id, { ...ticket, shorthand });
  });
