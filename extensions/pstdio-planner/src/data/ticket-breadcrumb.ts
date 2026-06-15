import type { StoredTicket } from "./types";

export type TicketBreadcrumbItem = Record<string, string> & {
  id: string;
  label: string;
  shorthand: string;
};

export type TicketParentLookup = Map<string, StoredTicket>;

export const ticketDisplayTitle = (ticket: StoredTicket) =>
  ticket.title ? `${ticket.shorthand} ${ticket.title}` : ticket.shorthand;

const ticketBreadcrumbItem = (ticket: StoredTicket): TicketBreadcrumbItem => ({
  id: ticket.id,
  label: ticketDisplayTitle(ticket),
  shorthand: ticket.shorthand,
});

export const buildTicketBreadcrumbItems = (ticket: StoredTicket, parentLookup: TicketParentLookup = new Map()) => {
  const items = [ticketBreadcrumbItem(ticket)];
  let current = ticket;
  const visitedTicketIds = new Set([ticket.id]);

  while (current.parentId) {
    if (visitedTicketIds.has(current.parentId)) break;
    const parent = parentLookup.get(current.parentId);
    if (!parent) break;
    visitedTicketIds.add(parent.id);
    items.unshift(ticketBreadcrumbItem(parent));
    current = parent;
  }

  return items;
};

export const ticketBreadcrumbResourceMetadata = (
  ticket: StoredTicket,
  parentLookup: TicketParentLookup = new Map(),
) => ({
  ticketId: ticket.id,
  ticketLabel: ticketDisplayTitle(ticket),
  ticketShorthand: ticket.shorthand,
  ticketBreadcrumb: buildTicketBreadcrumbItems(ticket, parentLookup),
});

export const ticketParentResourceMetadata = (parent: StoredTicket) => ({
  parentTicketId: parent.id,
  parentTicketLabel: ticketDisplayTitle(parent),
  parentTicketShorthand: parent.shorthand,
});
