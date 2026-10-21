import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { dependencyBlockerRefs, withIndependentBlockers } from "./dependency-blockers";
import { deriveReviewNeededFlag, readTicketReviewRequests, withReviewNeededFlag } from "./review-request-storage";
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
    tickets: withIndependentBlockers(tickets).map((ticket) =>
      withReviewNeededFlag(ticket, requests.get(ticket.id) ?? { requests: [], errors: [] }),
    ),
    requests,
  };
};

export const readTicketsWithReviewState = async (storage: ExtensionStorageApi) =>
  (await readTicketSnapshot(storage)).tickets;

export const withDerivedTicketState = async (storage: ExtensionStorageApi, ticket: StoredTicket) =>
  deriveReviewNeededFlag(storage, await withIndependentBlocker(storage, ticket));

const withIndependentBlocker = async (storage: ExtensionStorageApi, ticket: StoredTicket) => {
  if (!dependencyBlockerRefs(ticket.blockedReason)) return ticket;
  const tickets = (await ticketsCollection(storage).list()).filter(({ id }) => id !== ticket.id);
  return withIndependentBlockers([...tickets, ticket]).at(-1)!;
};
