import type { Ticket } from "@/features/ticket-list/types";

export const resolveTicketDetailsState = (params: {
  tickets: Ticket[] | undefined;
  ticketShorthand: string | undefined;
  isTicketsLoading: boolean;
}) => {
  const { tickets, ticketShorthand, isTicketsLoading } = params;

  if (isTicketsLoading || !tickets) {
    return { state: "loading", ticket: null };
  }

  const ticket = ticketShorthand ? (tickets.find((t) => t.shorthand === ticketShorthand) ?? null) : null;

  if (!ticket) {
    return { state: "not-found", ticket: null };
  }

  return { state: "ready", ticket };
};
