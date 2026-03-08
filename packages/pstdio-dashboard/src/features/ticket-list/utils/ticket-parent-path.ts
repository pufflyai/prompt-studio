import type { Ticket } from "@/features/ticket-list/types";

// Walks up the parentId chain and returns an array of ancestor shorthands (root-first).
export const buildParentPath = (ticket: Ticket, ticketsById: Map<string, Ticket>): string[] => {
  const path: string[] = [];
  const visited = new Set<string>();
  let current = ticket.parentId ? ticketsById.get(ticket.parentId) : undefined;

  while (current) {
    if (visited.has(current.id)) break;
    visited.add(current.id);
    path.unshift(current.shorthand);
    current = current.parentId ? ticketsById.get(current.parentId) : undefined;
  }

  return path;
};
