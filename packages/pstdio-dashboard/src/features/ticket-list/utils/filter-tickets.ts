import type { Ticket } from "@/features/ticket-list/types";

const normalize = (value: string) => value.trim().toLowerCase();

export const filterTickets = (tickets: Ticket[], query: string) => {
  const normalizedQuery = normalize(query);
  if (normalizedQuery.length === 0) return tickets;

  return tickets.filter((ticket) => {
    const fields = [ticket.title, ticket.shorthand, ticket.content];
    return fields.some((field) => normalize(field).includes(normalizedQuery));
  });
};
