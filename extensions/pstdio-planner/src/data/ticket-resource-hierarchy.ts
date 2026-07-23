import type { JsonObject } from "@pstdio/sdk/extensions";
import type { StoredTicket } from "./types";

export type TicketParentLookup = Map<string, StoredTicket>;

export interface TicketResourceReference extends JsonObject {
  type: "ticket";
  id: string;
  label: string;
  metadata: JsonObject;
}

export const ticketDisplayTitle = (ticket: StoredTicket) =>
  ticket.title ? `${ticket.shorthand} ${ticket.title}` : ticket.shorthand;

const createTicketResourceReference = (
  ticket: StoredTicket,
  parentLookup: TicketParentLookup,
  visitedTicketIds: Set<string>,
): TicketResourceReference => {
  const nextVisitedTicketIds = new Set(visitedTicketIds);
  nextVisitedTicketIds.add(ticket.id);
  const parent =
    ticket.parentId && !nextVisitedTicketIds.has(ticket.parentId) ? parentLookup.get(ticket.parentId) : undefined;
  const metadata: JsonObject = { shorthand: ticket.shorthand };
  if (parent) {
    metadata.resourceParent = createTicketResourceReference(parent, parentLookup, nextVisitedTicketIds);
  }

  return {
    type: "ticket",
    id: ticket.id,
    label: ticketDisplayTitle(ticket),
    metadata,
  };
};

export const ticketResourceReference = (ticket: StoredTicket, parentLookup: TicketParentLookup = new Map()) =>
  createTicketResourceReference(ticket, parentLookup, new Set());

export const ticketResourceHierarchyMetadata = (ticket: StoredTicket, parentLookup: TicketParentLookup = new Map()) =>
  ticketResourceReference(ticket, parentLookup).metadata;

export const linkedResourceParentMetadata = (ticket: StoredTicket, parentLookup: TicketParentLookup = new Map()) => ({
  resourceParent: ticketResourceReference(ticket, parentLookup),
});
