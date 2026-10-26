import type { CommandContext } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "./collections";
import { findTickets } from "./resolve";
import type { Ticket } from "./types";

export const findTicketsByShorthand = (ctx: CommandContext, shorthand: string) => findTickets(ctx, shorthand);

export const findTicketAncestors = async (ctx: CommandContext, ticket: Ticket) => {
  const ancestors = new Map<string, Ticket>();
  let parentId = ticket.parentId;
  while (parentId && !ancestors.has(parentId)) {
    const parent = await ticketsCollection(ctx).get(parentId);
    if (!parent) break;
    ancestors.set(parent.id, parent);
    parentId = parent.parentId;
  }
  return ancestors;
};
