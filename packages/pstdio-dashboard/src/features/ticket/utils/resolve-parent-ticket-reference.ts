import type { Ticket } from "@/features/ticket-list/types";

export const resolveParentTicketReference = (tickets: Ticket[], parentId: string | null | undefined) => {
  if (!parentId) return { shorthand: null, ticket: null };

  const ticket = tickets.find((t) => t.shorthand === parentId || t.id === parentId) ?? null;
  return { shorthand: parentId, ticket };
};
