import type { StoredTicket } from "./types";

export const ticketDisplayTitle = (ticket: StoredTicket) =>
  ticket.title ? `${ticket.shorthand} ${ticket.title}` : ticket.shorthand;

export const ticketResourceMetadata = (ticket: StoredTicket) => ({
  ticketId: ticket.id,
  ticketLabel: ticketDisplayTitle(ticket),
  ticketShorthand: ticket.shorthand,
});
