import type { Ticket } from "./types";

export type TicketSummary = Pick<
  Ticket,
  "id" | "shorthand" | "title" | "parentId" | "archived" | "statusId" | "tags" | "createdAt" | "updatedAt" | "dependsOn"
>;

export const ticketSummary = (ticket: TicketSummary) => {
  const { id, shorthand, title, parentId, archived, statusId, tags, createdAt, updatedAt, dependsOn } = ticket;
  return { id, shorthand, title, parentId, archived, statusId, tags, createdAt, updatedAt, dependsOn };
};
