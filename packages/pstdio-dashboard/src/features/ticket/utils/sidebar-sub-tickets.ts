import type { Ticket, TicketSubTicket } from "@/features/ticket-list/types";

export const resolveSidebarSubTickets = (
  tickets: Ticket[],
  parentTicketId: string,
  parentTicketShorthand?: string,
): TicketSubTicket[] =>
  tickets
    .filter((ticket) => ticket.parentId === parentTicketId || ticket.parentId === parentTicketShorthand)
    .map((ticket) => ({
      id: ticket.id,
      shorthand: ticket.shorthand,
      title: ticket.title,
      statusId: null,
    }));
