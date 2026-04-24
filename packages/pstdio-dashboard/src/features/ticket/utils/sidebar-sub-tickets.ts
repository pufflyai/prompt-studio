import type { Ticket, TicketSubTicket } from "@/features/ticket-list/types";

export const resolveSidebarSubTickets = (
  tickets: Ticket[],
  parentTicketId: string,
  parentTicketShorthand?: string,
): TicketSubTicket[] =>
  tickets
    .filter(
      (ticket) =>
        ticket.parentId === parentTicketId ||
        (Boolean(parentTicketShorthand) && ticket.parentId === parentTicketShorthand),
    )
    .sort((left, right) => left.shorthand.localeCompare(right.shorthand, undefined, { numeric: true }))
    .map((ticket) => ({
      id: ticket.id,
      shorthand: ticket.shorthand,
      title: ticket.title,
      statusId: null,
      status: ticket.status,
      statusColor: ticket.statusColor,
    }));
