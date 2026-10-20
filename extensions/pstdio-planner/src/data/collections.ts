import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { dependencyBlockerRefs, withIndependentBlockers } from "./dependency-blockers";
import { readTicketReviewRequests } from "./review-request-storage";
import type { StoredStatus, StoredTag, StoredTicket, Ticket } from "./types";

export { TICKETS_COLLECTION } from "./ticket-records";

import { type TicketContext, withTicketIdentities, withTicketIdentity } from "./ticket-identity";
import { ticketRecord, ticketRecords } from "./ticket-records";
export const STATUSES_COLLECTION = "ticket-statuses";
export const TAGS_COLLECTION = "ticket-tags";

export const ticketsCollection = (ctx: TicketContext) => {
  const records = ticketRecords(ctx.storage);
  return {
    get: async (id: string) => {
      const record = await records.get(id);
      return record ? withTicketIdentity(ctx, record) : undefined;
    },
    list: async () => withTicketIdentities(ctx, await records.list()),
    put: (id: string, ticket: StoredTicket) => records.put(id, ticketRecord(ticket)),
    update: (id: string, ticket: StoredTicket) => records.update(id, ticketRecord(ticket)),
    delete: (id: string) => records.delete(id),
  };
};

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

export const withDerivedTicketState = async (ctx: TicketContext, ticket: Ticket) =>
  withIndependentBlocker(ctx, ticket);

const withIndependentBlocker = async (ctx: TicketContext, ticket: Ticket) => {
  if (!dependencyBlockerRefs(ticket.blockedReason)) return ticket;
  const tickets = (await ticketsCollection(ctx).list()).filter(({ id }) => id !== ticket.id);
  return withIndependentBlockers([...tickets, ticket]).at(-1)!;
};
