import type { Ticket } from "../types";

export const matchesTicketSearch = (ticket: Ticket, searchTerm: string) => {
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  if (normalizedSearchTerm.length === 0) return true;

  const searchableFields = [ticket.shorthand, ticket.title, ticket.content];
  return searchableFields.some((field) => field.toLowerCase().includes(normalizedSearchTerm));
};
