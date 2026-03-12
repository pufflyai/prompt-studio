import type { Ticket } from "@/features/ticket-list/types";

export const getVisibleTickets = (tickets: Ticket[]) => tickets.filter((ticket) => !ticket.archived && !ticket.draft);
