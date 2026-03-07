import type { Ticket, TicketStatus } from "@/features/ticket-list/types";

export const moveTicket = (tickets: Ticket[], ticketId: string, nextStatus: TicketStatus) =>
  tickets.map((ticket) => (ticket.id === ticketId ? { ...ticket, status: nextStatus } : ticket));
