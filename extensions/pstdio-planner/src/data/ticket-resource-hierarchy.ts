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

const createTicketResourceReference = (lineage: StoredTicket[], index: number): TicketResourceReference => {
  const ticket = lineage[index];
  const metadata: JsonObject = { shorthand: ticket.shorthand };
  if (index > 0) {
    metadata.resourceParent = createTicketResourceReference(lineage, index - 1);
  }

  return {
    type: "ticket",
    id: ticket.id,
    label: ticketDisplayTitle(ticket),
    metadata,
  };
};

export const resolveTicketHierarchy = (ticket: StoredTicket, parentLookup: TicketParentLookup = new Map()) => {
  const lineage = [];
  const visitedTicketIds = new Set<string>();
  let current: StoredTicket | undefined = ticket;

  while (current && !visitedTicketIds.has(current.id)) {
    lineage.push(current);
    visitedTicketIds.add(current.id);
    current = current.parentId ? parentLookup.get(current.parentId) : undefined;
  }

  lineage.reverse();
  const resourceReference = createTicketResourceReference(lineage, lineage.length - 1);

  return {
    lineage,
    breadcrumb: lineage.map(({ shorthand }) => shorthand).join(" / "),
    parent: lineage[lineage.length - 2],
    resourceReference,
  };
};

export const ticketResourceReference = (ticket: StoredTicket, parentLookup: TicketParentLookup = new Map()) =>
  resolveTicketHierarchy(ticket, parentLookup).resourceReference;

export const ticketResourceHierarchyMetadata = (ticket: StoredTicket, parentLookup: TicketParentLookup = new Map()) =>
  ticketResourceReference(ticket, parentLookup).metadata;

export const linkedResourceParentMetadata = (ticket: StoredTicket, parentLookup: TicketParentLookup = new Map()) => ({
  resourceParent: ticketResourceReference(ticket, parentLookup),
});
