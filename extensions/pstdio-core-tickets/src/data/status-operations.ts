import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { putStatus, putTicket, statusesCollection, ticketsCollection } from "./collections";
import { seedDefaultStatuses } from "./seed";
import { sortedBySortOrder } from "./sort";
import type { StoredStatus } from "./types";

export const readTicketStatuses = async (storage: ExtensionStorageApi) => ({
  statuses: sortedBySortOrder(await seedDefaultStatuses(storage)),
});

export const createTicketStatus = async (input: { storage: ExtensionStorageApi; name: string; color?: string }) => {
  const statuses = await seedDefaultStatuses(input.storage);
  const sortOrder = Math.max(-1, ...statuses.map((status) => status.sortOrder)) + 1;
  const status: StoredStatus = {
    id: crypto.randomUUID(),
    name: input.name,
    color: input.color ?? "gray",
    sortOrder,
    isDefault: false,
    canCreate: true,
    canDragIn: true,
    canDragOut: true,
    columnActions: [],
  };
  return putStatus(input.storage, status);
};

export const updateTicketStatus = async (input: {
  storage: ExtensionStorageApi;
  statusId: string;
  name?: string;
  color?: string;
}) => {
  const current = await statusesCollection(input.storage).get(input.statusId);
  if (!current) throw new Error(`Unknown ticket status: ${input.statusId}`);

  return putStatus(input.storage, {
    ...current,
    name: input.name ?? current.name,
    color: input.color ?? current.color,
  });
};

// Reassign tickets in the removed column to the remaining default so they stay
// visible on the board instead of pointing at a status that no longer exists.
export const deleteTicketStatus = async (input: { storage: ExtensionStorageApi; statusId: string }) => {
  const remaining = (await statusesCollection(input.storage).list()).filter((status) => status.id !== input.statusId);
  const fallbackId = (remaining.find((status) => status.isDefault) ?? remaining[0])?.id ?? null;

  await Promise.all(
    (await ticketsCollection(input.storage).list()).map((ticket) =>
      ticket.statusId === input.statusId ? putTicket(input.storage, { ...ticket, statusId: fallbackId }) : undefined,
    ),
  );

  await statusesCollection(input.storage).delete(input.statusId);
  return { statusId: input.statusId };
};

export const reorderTicketStatuses = async (input: { storage: ExtensionStorageApi; statusIds: string[] }) => {
  const statuses = sortedBySortOrder(await statusesCollection(input.storage).list());
  const statusesById = new Map(statuses.map((status) => [status.id, status]));
  const requestedIds = new Set<string>();
  const requestedStatuses: StoredStatus[] = [];

  for (const statusId of input.statusIds) {
    const status = statusesById.get(statusId);
    if (!status || requestedIds.has(status.id)) continue;
    requestedIds.add(status.id);
    requestedStatuses.push(status);
  }

  const nextStatuses = [...requestedStatuses, ...statuses.filter((status) => !requestedIds.has(status.id))];
  await Promise.all(nextStatuses.map((status, sortOrder) => putStatus(input.storage, { ...status, sortOrder })));

  return readTicketStatuses(input.storage);
};
