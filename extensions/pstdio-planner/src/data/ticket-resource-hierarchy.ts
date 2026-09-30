import type { JsonObject } from "@pstdio/sdk/extensions";
import type { StoredTicket } from "./types";

export type TicketParentLookup = Map<string, StoredTicket>;

export interface TicketResourceReference extends JsonObject {
  type: "ticket";
  id: string;
  label: string;
  shorthand: string;
  metadata: JsonObject;
}

export const ticketDisplayTitle = (ticket: StoredTicket) =>
  ticket.title ? `${ticket.shorthand} ${ticket.title}` : ticket.shorthand;

const ticketsBrowseRootReference = (): JsonObject => ({
  type: "view",
  viewId: "pstdio.pstdio-planner.view.tickets",
});

const createTicketResourceIdentity = (lineage: StoredTicket[], index: number): TicketResourceReference => {
  const ticket = lineage[index];
  const metadata: JsonObject = {
    resourceParent: index > 0 ? createTicketResourceIdentity(lineage, index - 1) : ticketsBrowseRootReference(),
  };

  return {
    type: "ticket",
    id: ticket.id,
    shorthand: ticket.shorthand,
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
  const identity = createTicketResourceIdentity(lineage, lineage.length - 1);
  // Menus read the state of the open or clicked ticket. When expressions only match
  // equal values, so the state is always present.
  const resourceReference: TicketResourceReference = {
    ...identity,
    metadata: { archived: ticket.archived === true, ...identity.metadata },
  };

  return {
    lineage,
    breadcrumb: lineage.map(({ shorthand }) => shorthand).join(" / "),
    parent: lineage[lineage.length - 2],
    identity,
    resourceReference,
  };
};

export const ticketResourceReference = (ticket: StoredTicket, parentLookup: TicketParentLookup = new Map()) =>
  resolveTicketHierarchy(ticket, parentLookup).resourceReference;

// Stored links (session and workspace anchors) keep only the ticket's identity and
// ancestry. Its state would go stale in the copy.
export const ticketResourceIdentity = (ticket: StoredTicket, parentLookup: TicketParentLookup = new Map()) =>
  resolveTicketHierarchy(ticket, parentLookup).identity;

export const linkedResourceParentMetadata = (ticket: StoredTicket, parentLookup: TicketParentLookup = new Map()) => ({
  resourceParent: ticketResourceIdentity(ticket, parentLookup),
});
