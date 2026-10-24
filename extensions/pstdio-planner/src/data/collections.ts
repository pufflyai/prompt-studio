import type { ExtensionStorageApi, ExtensionStorageCollectionApi } from "@pstdio/sdk/extensions";
import { dependencyBlockerRefs, withIndependentBlockers } from "./dependency-blockers";
import { readTicketReviewRequests } from "./review-request-storage";
import { deleteTicketBlobs, deleteTicketFileContent } from "./ticket-file-content";
import { queueTicketWrite } from "./ticket-write-queue";
import type { StoredStatus, StoredTag, StoredTicket } from "./types";

export const TICKETS_COLLECTION = "tickets";
export const STATUSES_COLLECTION = "ticket-statuses";
export const TAGS_COLLECTION = "ticket-tags";

const storedTickets = (storage: ExtensionStorageApi) => storage.collection<StoredTicket>(TICKETS_COLLECTION);

// File bodies are blobs, deleted once the file list stops using them. A write that read the
// ticket before a file change would bring back a list whose blobs are gone. So only
// changeTicketFiles changes the list, and every write runs in the ticket's queue and keeps the
// stored list.
const withStoredFiles = async (storage: ExtensionStorageApi, id: string, ticket: StoredTicket) => {
  const stored = await storedTickets(storage).get(id);
  return stored ? { ...ticket, files: stored.files } : ticket;
};

export const ticketsCollection = (storage: ExtensionStorageApi) => {
  const tickets = storedTickets(storage);
  return {
    get: (id) => tickets.get(id),
    list: () => tickets.list(),
    createIfAbsent: (id, ticket) => tickets.createIfAbsent(id, ticket),
    create: (ticket) => tickets.create(ticket),
    attachments: (id) => tickets.attachments(id),
    put: (id, ticket) => queueTicketWrite(id, async () => tickets.put(id, await withStoredFiles(storage, id, ticket))),
    update: (id, ticket) =>
      queueTicketWrite(id, async () => tickets.update(id, await withStoredFiles(storage, id, ticket))),
    // The ticket's blobs, file bodies and images alike, have no other owner.
    delete: (id) =>
      queueTicketWrite(id, async () => {
        await tickets.delete(id);
        await deleteTicketBlobs(storage, id);
      }),
    deleteIfValue: (id, ticket) =>
      queueTicketWrite(id, async () => {
        const deleted = await tickets.deleteIfValue(id, ticket);
        if (deleted) await deleteTicketBlobs(storage, id);
        return deleted;
      }),
  } satisfies ExtensionStorageCollectionApi<StoredTicket>;
};

/**
 * The only write that changes a ticket's file list. `change` receives the stored ticket inside the
 * ticket's queue and returns it unchanged to skip the write. The bodies the new list no longer
 * uses are deleted after the write.
 */
export const changeTicketFiles = (
  storage: ExtensionStorageApi,
  ticketId: string,
  change: (stored: StoredTicket) => Promise<StoredTicket>,
) =>
  queueTicketWrite(ticketId, async () => {
    const stored = await storedTickets(storage).get(ticketId);
    if (!stored) throw new Error(`Unknown ticket: ${ticketId}`);
    const changed = await change(stored);
    if (changed === stored) return stored;
    const next = await withDerivedTicketState(storage, changed);
    await storedTickets(storage).update(ticketId, next);
    const kept = new Set((next.files ?? []).map((file) => file.blobId));
    const unused = (stored.files ?? []).map((file) => file.blobId).filter((blobId) => !kept.has(blobId));
    await deleteTicketFileContent(storage, ticketId, unused);
    return next;
  });

export const statusesCollection = (storage: ExtensionStorageApi) =>
  storage.collection<StoredStatus>(STATUSES_COLLECTION);

export const tagsCollection = (storage: ExtensionStorageApi) => storage.collection<StoredTag>(TAGS_COLLECTION);

// The runtime's collection.create() stores the value *without* the generated id,
// so list()/get() would lose it. We own the id and persist it inside the value.
export const putTicket = async (storage: ExtensionStorageApi, ticket: StoredTicket) => {
  const next = await withDerivedTicketState(storage, ticket);
  await ticketsCollection(storage).put(ticket.id, next);
  return next;
};

export const updateTicket = async (storage: ExtensionStorageApi, ticket: StoredTicket) => {
  const next = await withDerivedTicketState(storage, ticket);
  await ticketsCollection(storage).update(ticket.id, next);
  return next;
};

export const putStatus = async (storage: ExtensionStorageApi, status: StoredStatus) => {
  await statusesCollection(storage).put(status.id, status);
  return status;
};

export const putTag = async (storage: ExtensionStorageApi, tag: StoredTag) => {
  await tagsCollection(storage).put(tag.id, tag);
  return tag;
};

export const readTicketSnapshot = async (storage: ExtensionStorageApi) => {
  const [tickets, requests] = await Promise.all([ticketsCollection(storage).list(), readTicketReviewRequests(storage)]);
  return {
    tickets: withIndependentBlockers(tickets),
    requests,
  };
};

export const readTicketsWithReviewState = async (storage: ExtensionStorageApi) =>
  (await readTicketSnapshot(storage)).tickets;

export const withDerivedTicketState = async (storage: ExtensionStorageApi, ticket: StoredTicket) =>
  withIndependentBlocker(storage, ticket);

const withIndependentBlocker = async (storage: ExtensionStorageApi, ticket: StoredTicket) => {
  if (!dependencyBlockerRefs(ticket.blockedReason)) return ticket;
  const tickets = (await ticketsCollection(storage).list()).filter(({ id }) => id !== ticket.id);
  return withIndependentBlockers([...tickets, ticket]).at(-1)!;
};
