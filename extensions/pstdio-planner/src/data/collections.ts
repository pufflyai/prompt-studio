import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { dependencyBlockerRefs, withIndependentBlockers } from "./dependency-blockers";
import { readTicketReviewRequests } from "./review-request-storage";
import { deleteTicketBlobs, deleteTicketFileContent } from "./ticket-file-content";
import { queueTicketWrite } from "./ticket-write-queue";
import type { StoredStatus, StoredTag, StoredTicket, Ticket } from "./types";

export { TICKETS_COLLECTION } from "./ticket-records";

import { readTicketIdentity, type TicketContext, withTicketIdentities, withTicketIdentity } from "./ticket-identity";
import { ticketRecord, ticketRecords } from "./ticket-records";
export const STATUSES_COLLECTION = "ticket-statuses";
export const TAGS_COLLECTION = "ticket-tags";

// File bodies are blobs, deleted once the file list stops using them. A write that read the
// ticket before a file change would bring back a list whose blobs are gone. So only
// changeTicketFiles changes the list, and every write runs in the ticket's queue and keeps the
// stored list.
const withStoredFiles = async (storage: ExtensionStorageApi, id: string, ticket: StoredTicket) => {
  const stored = await ticketRecords(storage).get(id);
  return stored ? { ...ticket, files: stored.files } : ticket;
};

export const ticketsCollection = (ctx: TicketContext) => {
  const records = ticketRecords(ctx.storage);
  return {
    get: async (id: string) => {
      const record = await records.get(id);
      return record ? readTicketIdentity(ctx, record) : undefined;
    },
    getMany: async (ids: string[]) => {
      const selected = await Promise.all(ids.map((id) => records.get(id)));
      const tickets = await withTicketIdentities(
        ctx,
        selected.filter((ticket) => ticket !== undefined),
      );
      const byId = new Map(tickets.map((ticket) => [ticket.id, ticket]));
      return ids.map((id) => byId.get(id));
    },
    list: async () => withTicketIdentities(ctx, await records.list()),
    put: (id: string, ticket: StoredTicket) =>
      queueTicketWrite(id, async () => records.put(id, ticketRecord(await withStoredFiles(ctx.storage, id, ticket)))),
    update: (id: string, ticket: StoredTicket) =>
      queueTicketWrite(id, async () =>
        records.update(id, ticketRecord(await withStoredFiles(ctx.storage, id, ticket))),
      ),
    // The ticket's blobs, file bodies and images alike, have no other owner.
    delete: (id: string) =>
      queueTicketWrite(id, async () => {
        await records.delete(id);
        await deleteTicketBlobs(ctx.storage, id);
      }),
  };
};

/**
 * The only write that changes a ticket's file list. `change` receives the stored ticket, with its
 * core number, inside the ticket's queue and returns it unchanged to skip the write. The bodies
 * the new list no longer uses are deleted after the write.
 */
export const changeTicketFiles = (ctx: TicketContext, ticketId: string, change: (stored: Ticket) => Promise<Ticket>) =>
  queueTicketWrite(ticketId, async () => {
    const stored = await ticketsCollection(ctx).get(ticketId);
    if (!stored) throw new Error(`Unknown ticket: ${ticketId}`);
    const changed = await change(stored);
    if (changed === stored) return stored;
    const next = await withDerivedTicketState(ctx, changed);
    await ticketRecords(ctx.storage).update(ticketId, ticketRecord(next));
    const kept = new Set((next.files ?? []).map((file) => file.blobId));
    const unused = (stored.files ?? []).map((file) => file.blobId).filter((blobId) => !kept.has(blobId));
    await deleteTicketFileContent(ctx.storage, ticketId, unused);
    return next;
  });

export const statusesCollection = (storage: ExtensionStorageApi) =>
  storage.collection<StoredStatus>(STATUSES_COLLECTION);

export const tagsCollection = (storage: ExtensionStorageApi) => storage.collection<StoredTag>(TAGS_COLLECTION);

// The runtime's collection.create() stores the value *without* the generated id,
// so list()/get() would lose it. We own the id and persist it inside the value.
export const putTicket = async (ctx: TicketContext, ticket: StoredTicket) => {
  const next = await withDerivedTicketState(ctx, await withTicketIdentity(ctx, ticket));
  await ticketsCollection(ctx).put(ticket.id, next);
  return next;
};

export const updateTicket = async (ctx: TicketContext, ticket: StoredTicket) => {
  const next = await withDerivedTicketState(ctx, await withTicketIdentity(ctx, ticket));
  await ticketsCollection(ctx).update(ticket.id, next);
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

export const readTicketSnapshot = async (ctx: TicketContext) => {
  const [tickets, requests] = await Promise.all([ticketsCollection(ctx).list(), readTicketReviewRequests(ctx.storage)]);
  return {
    tickets: withIndependentBlockers(tickets),
    requests,
  };
};

export const readTicketsWithReviewState = async (ctx: TicketContext) => (await readTicketSnapshot(ctx)).tickets;

export const withDerivedTicketState = async (ctx: TicketContext, ticket: Ticket) => withIndependentBlocker(ctx, ticket);

const withIndependentBlocker = async (ctx: TicketContext, ticket: Ticket) => {
  if (!dependencyBlockerRefs(ticket.blockedReason)) return ticket;
  const tickets = (await ticketsCollection(ctx).list()).filter(({ id }) => id !== ticket.id);
  return withIndependentBlockers([...tickets, ticket]).at(-1)!;
};
