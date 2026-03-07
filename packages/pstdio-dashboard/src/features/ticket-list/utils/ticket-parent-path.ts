import type { Ticket } from "@/features/ticket-list/types";

// Walks up the parentId chain and returns an array of ancestor shorthands (root-first).
export const buildParentPath = (ticket: Ticket, ticketsById: Map<string, Ticket>): string[] => {
  const path: string[] = [];
  let current = ticket.parentId ? ticketsById.get(ticket.parentId) : undefined;

  while (current) {
    path.unshift(current.shorthand);
    current = current.parentId ? ticketsById.get(current.parentId) : undefined;
  }

  return path;
};
