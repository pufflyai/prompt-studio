import type { Ticket } from "./types";

export type TicketSummary = Pick<
  Ticket,
  "id" | "shorthand" | "title" | "parentId" | "archived" | "statusId" | "tagIds" | "createdAt" | "updatedAt"
>;

export const ticketSummary = (ticket: TicketSummary) => {
  const { id, shorthand, title, parentId, archived, statusId, tagIds, createdAt, updatedAt } = ticket;
  return { id, shorthand, title, parentId, archived, statusId, tagIds, createdAt, updatedAt };
};
