import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { statusesCollection, tagsCollection, ticketsCollection } from "./collections";

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// Resolution lives next to the data so any client (CLI, board, integrations) can
// address tickets/statuses/tags by human name or shorthand. We match an exact id
// first, then a case-insensitive name, and fail loudly on unknown or ambiguous
// values rather than picking arbitrarily (Decision 3).
const resolveByIdOrName = <TItem extends { id: string }>(
  items: TItem[],
  value: string,
  nameOf: (item: TItem) => string,
  label: string,
) => {
  const byId = items.find((item) => item.id === value);
  if (byId) return byId.id;

  const byName = items.filter((item) => sameName(nameOf(item), value));
  if (byName.length > 1) throw new Error(`Ambiguous ${label} "${value}"`);

  const [match] = byName;
  if (match) return match.id;
  throw new Error(`Unknown ${label} "${value}"`);
};

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
