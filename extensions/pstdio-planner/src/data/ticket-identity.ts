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

export const withTicketIdentities = async <T extends { id: string }>(ctx: TicketContext, tickets: T[]) => {
  const result: ReturnType<typeof ticketWithIdentity<T>>[] = [];
  for (let offset = 0; offset < tickets.length; offset += 100) {
    const batch = tickets.slice(offset, offset + 100);
    const identities = await ctx.resources.identityMany({ kind: "ticket", ids: batch.map((ticket) => ticket.id) });
    result.push(...batch.map((ticket, index) => ticketWithIdentity(ticket, identities[index] ?? null)));
  }
  return result;
};

export const allocateTicketIdentity = (ctx: TicketContext) => ctx.resources.allocate({ kind: "ticket" });
