import type { ExtensionContextBase, ResourceIdentity } from "@pstdio/sdk/extensions";
import { deriveTitle } from "../utils/derive-title";

export type TicketContext = Pick<ExtensionContextBase, "storage" | "resources">;
type TicketIdentityInput = { id: string; content?: string };

// Native record text is already saved; read its title without a second text write.
export const ticketWithCurrentTitle = <T extends TicketIdentityInput>(ticket: T) => ({
  ...ticket,
  ...(ticket.content ? { title: deriveTitle(ticket.content) } : {}),
});

export const ticketWithIdentity = <T extends TicketIdentityInput>(ticket: T, identity: ResourceIdentity | null) => {
  if (!identity) throw new Error(`Core identity is missing for ticket "${ticket.id}"`);
  return {
    ...ticket,
    shorthand: identity.shorthand,
    ...(identity.aliases.length ? { aliases: identity.aliases } : {}),
  };
};

export const withTicketIdentity = async <T extends TicketIdentityInput>(ctx: TicketContext, ticket: T) =>
  ticketWithIdentity(ticket, await ctx.resources.identity({ kind: "ticket", id: ticket.id }));

// Ticket records and core numbers sync separately, so a synced record can arrive before its
// number. Reads skip such a record until its number arrives; writes still require the number.
export const readTicketIdentity = async <T extends TicketIdentityInput>(ctx: TicketContext, ticket: T) => {
  const identity = await ctx.resources.identity({ kind: "ticket", id: ticket.id });
  return identity ? ticketWithIdentity(ticketWithCurrentTitle(ticket), identity) : undefined;
};

export const withTicketIdentities = async <T extends TicketIdentityInput>(ctx: TicketContext, tickets: T[]) => {
  const result: ReturnType<typeof ticketWithIdentity<T>>[] = [];
  for (let offset = 0; offset < tickets.length; offset += 100) {
    const batch = tickets.slice(offset, offset + 100);
    const identities = await ctx.resources.identityMany({ kind: "ticket", ids: batch.map((ticket) => ticket.id) });
    batch.forEach((ticket, index) => {
      const identity = identities[index];
      if (identity) result.push(ticketWithIdentity(ticketWithCurrentTitle(ticket), identity));
    });
  }
  return result;
};

export const allocateTicketIdentity = (ctx: TicketContext) => ctx.resources.allocate({ kind: "ticket" });
