import type { ExtensionContextBase, ResourceIdentity } from "@pstdio/sdk/extensions";

export type TicketContext = Pick<ExtensionContextBase, "storage" | "resources">;

export const ticketWithIdentity = <T extends { id: string }>(ticket: T, identity: ResourceIdentity | null) => {
  if (!identity) throw new Error(`Core identity is missing for ticket "${ticket.id}"`);
  return {
    ...ticket,
    shorthand: identity.shorthand,
    ...(identity.aliases.length ? { aliases: identity.aliases } : {}),
  };
};

export const withTicketIdentity = async <T extends { id: string }>(ctx: TicketContext, ticket: T) =>
  ticketWithIdentity(ticket, await ctx.resources.identity({ kind: "ticket", id: ticket.id }));

// Ticket records and core numbers sync separately, so a synced record can arrive before its
// number. Reads skip such a record until its number arrives; writes still require the number.
export const readTicketIdentity = async <T extends { id: string }>(ctx: TicketContext, ticket: T) => {
  const identity = await ctx.resources.identity({ kind: "ticket", id: ticket.id });
  return identity ? ticketWithIdentity(ticket, identity) : undefined;
};

export const withTicketIdentities = async <T extends { id: string }>(ctx: TicketContext, tickets: T[]) => {
  const result: ReturnType<typeof ticketWithIdentity<T>>[] = [];
  for (let offset = 0; offset < tickets.length; offset += 100) {
    const batch = tickets.slice(offset, offset + 100);
    const identities = await ctx.resources.identityMany({ kind: "ticket", ids: batch.map((ticket) => ticket.id) });
    batch.forEach((ticket, index) => {
      const identity = identities[index];
      if (identity) result.push(ticketWithIdentity(ticket, identity));
    });
  }
  return result;
};

export const allocateTicketIdentity = (ctx: TicketContext) => ctx.resources.allocate({ kind: "ticket" });
