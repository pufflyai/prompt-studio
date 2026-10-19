import type { CommandContext } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "./collections";
import type { StoredTicket } from "./types";

// Storage only finds tickets by id, and chat can resolve thousands of ticket paths while scrolling.
// This keeps the shorthand-to-id map from the last full read for each project. A hit is read again
// and checked, so a renumbered or deleted ticket is never returned. A miss reads every ticket, which
// also finds tickets created since then. Shorthands can repeat after offline edits, so each keeps all ids.
const shorthandIds = new Map<string, Map<string, string[]>>();

const readAllTickets = async (ctx: CommandContext) => {
  const tickets = await ticketsCollection(ctx.storage).list();
  const ids = new Map<string, string[]>();
  for (const ticket of tickets) ids.set(ticket.shorthand, [...(ids.get(ticket.shorthand) ?? []), ticket.id]);
  shorthandIds.set(ctx.projectId, ids);
  return tickets;
};

export const findTicketByShorthand = async (ctx: CommandContext, shorthand: string) => {
  for (const id of shorthandIds.get(ctx.projectId)?.get(shorthand) ?? []) {
    const ticket = await ticketsCollection(ctx.storage).get(id);
    if (ticket?.shorthand === shorthand) return ticket;
  }
  return (await readAllTickets(ctx)).find((ticket) => ticket.shorthand === shorthand);
};

export const findTicketAncestors = async (ctx: CommandContext, ticket: StoredTicket) => {
  const ancestors = new Map<string, StoredTicket>();
  let parentId = ticket.parentId;
  while (parentId && !ancestors.has(parentId)) {
    const parent = await ticketsCollection(ctx.storage).get(parentId);
    if (!parent) break;
    ancestors.set(parent.id, parent);
    parentId = parent.parentId;
  }
  return ancestors;
};
