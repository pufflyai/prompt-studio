import { resolveByIdOrName, sameName } from "@pstdio/sdk/data";
import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { statusesCollection, tagsCollection, ticketsCollection } from "./collections";

export const resolveStatusId = async (storage: ExtensionStorageApi, value: string) =>
  resolveByIdOrName(await statusesCollection(storage).list(), value, (status) => status.name, "status");

export const resolveTagId = async (storage: ExtensionStorageApi, value: string) =>
  resolveByIdOrName(await tagsCollection(storage).list(), value, (tag) => tag.name, "tag");

export const resolveTagOptionIds = async (storage: ExtensionStorageApi, values: string[]) => {
  const options = (await tagsCollection(storage).list()).flatMap((tag) => tag.options);
  return values.map((value) => resolveByIdOrName(options, value, (option) => option.name, "tag option"));
};

// Tickets resolve leniently: board autosave passes a real id and tolerates a
// miss (returns undefined), while callers that need a hard reference (e.g. a
// parent link) use resolveTicketId, which fails loudly on an unknown shorthand.
export const findTicket = async (storage: ExtensionStorageApi, value: string) => {
  const tickets = await ticketsCollection(storage).list();
  const byId = tickets.find((ticket) => ticket.id === value);
  if (byId) return byId;

  const byShorthand = tickets.filter((ticket) => sameName(ticket.shorthand, value));
  if (byShorthand.length > 1) throw new Error(`Ambiguous ticket "${value}"`);
  return byShorthand[0];
};

export const resolveTicketId = async (storage: ExtensionStorageApi, value: string) => {
  const ticket = await findTicket(storage, value);
  if (!ticket) throw new Error(`Unknown ticket "${value}"`);
  return ticket.id;
};
