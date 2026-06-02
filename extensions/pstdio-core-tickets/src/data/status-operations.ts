import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { putStatus, putTicket, statusesCollection, ticketsCollection } from "./collections";
import { seedDefaultStatuses } from "./seed";
import type { StoredStatus } from "./types";

const bySortOrder = (left: StoredStatus, right: StoredStatus) =>
  left.sortOrder - right.sortOrder || left.name.localeCompare(right.name);

const sorted = (statuses: StoredStatus[]) => [...statuses].sort(bySortOrder);

export const readTicketStatuses = async (storage: ExtensionStorageApi) => ({
  statuses: sorted(await seedDefaultStatuses(storage)),
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

  for (const ticket of await ticketsCollection(input.storage).list()) {
    if (ticket.statusId === input.statusId) await putTicket(input.storage, { ...ticket, statusId: fallbackId });
  }

  await statusesCollection(input.storage).delete(input.statusId);
  return { statusId: input.statusId };
};

export const reorderTicketStatuses = async (input: { storage: ExtensionStorageApi; statusIds: string[] }) => {
  const statusesById = new Map((await statusesCollection(input.storage).list()).map((status) => [status.id, status]));

  for (const [index, statusId] of input.statusIds.entries()) {
    const status = statusesById.get(statusId);
    if (!status) continue;
    await putStatus(input.storage, { ...status, sortOrder: index });
  }

  return readTicketStatuses(input.storage);
};
