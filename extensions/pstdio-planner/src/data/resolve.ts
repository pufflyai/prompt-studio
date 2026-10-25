import { resolveByIdOrName } from "@pstdio/sdk/data";
import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { statusesCollection, tagsCollection, ticketsCollection, withDerivedTicketState } from "./collections";
import { type TicketContext, ticketWithIdentity } from "./ticket-identity";
import { ticketRecords } from "./ticket-records";

export const resolveStatusId = async (storage: ExtensionStorageApi, value: string) =>
  resolveByIdOrName(await statusesCollection(storage).list(), value, (status) => status.name, "status");

export const resolveTagId = async (storage: ExtensionStorageApi, value: string) =>
  resolveByIdOrName(await tagsCollection(storage).list(), value, (tag) => tag.name, "tag");

export const resolveTagOptionIds = async (storage: ExtensionStorageApi, values: string[]) => {
  const options = (await tagsCollection(storage).list()).flatMap((tag) => tag.options);
  return values.map((value) => resolveByIdOrName(options, value, (option) => option.name, "tag option"));
};

export const findStoredTickets = async (ctx: TicketContext, value: string) => {
  const byId = await ticketsCollection(ctx).get(value);
  if (byId) return [byId];
  const identities = await ctx.resources.findByShorthand({ kind: "ticket", shorthand: value.trim().toUpperCase() });
  const records = ticketRecords(ctx.storage);
  const matches = await Promise.all(
    identities.map(async (identity) => {
      const ticket = await records.get(identity.id);
      return ticket ? ticketWithIdentity(ticket, identity) : undefined;
    }),
  );
  return matches.filter((ticket) => ticket !== undefined);
};

// Editors load only the selected ticket. Derived dependency state is read by callers that need it.
export const findStoredTicket = async (ctx: TicketContext, value: string) => {
  const matches = await findStoredTickets(ctx, value);
  if (matches.length > 1)
    throw new Error(
      `Ticket "${value}" matches several tickets: ${matches.map((ticket) => `${ticket.shorthand} (${ticket.id})`).join(", ")}. Use a ticket ID.`,
    );
  return matches[0];
};

export const findTicket = async (ctx: TicketContext, value: string) => {
  const ticket = await findStoredTicket(ctx, value);
  if (!ticket) return undefined;
  return withDerivedTicketState(ctx, ticket);
};

export const findTickets = async (ctx: TicketContext, value: string) =>
  Promise.all((await findStoredTickets(ctx, value)).map((ticket) => withDerivedTicketState(ctx, ticket)));

export const resolveTicketId = async (ctx: TicketContext, value: string) => {
  const ticket = await findTicket(ctx, value);
  if (!ticket) throw new Error(`Unknown ticket "${value}"`);
  return ticket.id;
};

// A value that names a ticket already linked keeps that link. After an offline
// merge, a ticket's old number can be shared, but an unchanged relationship
// still points at one stored ID.
export const resolveLinkedTicketId = async (ctx: TicketContext, value: string, linkedIds: string[]) => {
  const linked = (await findStoredTickets(ctx, value)).filter((ticket) => linkedIds.includes(ticket.id));
  // Several linked matches stay ambiguous, so the lookup below asks for a ticket ID.
  return linked.length === 1 ? linked[0]!.id : resolveTicketId(ctx, value);
};

// Dependencies are written as shorthands by both routes that set them (the
// `--depends-on` flag and `depends_on` frontmatter) but stored as ticket ids.
// Both go through here so the two cannot drift.
export const resolveDependencyIds = async (ctx: TicketContext, values: string[], linkedIds: string[]) =>
  Promise.all(values.map((value) => resolveLinkedTicketId(ctx, value, linkedIds)));

export const requireTickets = async (ctx: TicketContext, value: string) => {
  const tickets = await findTickets(ctx, value);
  if (!tickets.length) throw new Error(`Unknown ticket "${value}"`);
  return tickets;
};
