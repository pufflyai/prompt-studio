import { defineCommand, params } from "@pstdio/sdk/extensions";

export interface TicketStatusDraft {
  id: string;
  label: string;
  color: string;
  icon?: string | null;
  sortOrder: number;
  isDefault?: boolean;
  actions?: string[];
}

import { putStatus, putTicket, statusesCollection, ticketsCollection } from "./data/collections";
import { migratePlannerStorage } from "./data/migrate-storage";
import { seedDefaultStatuses } from "./data/seed";
import type { StoredStatus } from "./data/types";
import { plannerSchemaChanged, plannerTicketsChanged } from "./events";
import { sortedBySortOrder } from "./utils/sort";

// Creating a ticket in a column is a command on the status, so it travels in the
// same list as the column commands instead of a separate flag on the record.
const CREATE_COMMAND = "create";

const toCommands = (status: Pick<StoredStatus, "canCreate" | "columnActions">) => [
  ...(status.canCreate ? [CREATE_COMMAND] : []),
  ...status.columnActions,
];

const toTicketStatusDraft = (status: StoredStatus): TicketStatusDraft => ({
  id: status.id,
  label: status.name,
  color: status.color,
  icon: status.icon,
  sortOrder: status.sortOrder,
  isDefault: status.isDefault,
  actions: toCommands(status),
});

const toStoredStatus = (status: TicketStatusDraft, stored: StoredStatus | undefined): StoredStatus => {
  const commands =
    status.actions ?? toCommands({ canCreate: stored?.canCreate ?? false, columnActions: stored?.columnActions ?? [] });

  return {
    id: status.id,
    name: status.label,
    color: status.color,
    icon: status.icon ?? null,
    sortOrder: status.sortOrder,
    isDefault: status.isDefault ?? false,
    canCreate: commands.includes(CREATE_COMMAND),
    columnActions: commands.filter((command) => command !== CREATE_COMMAND),
  };
};

export const readStatusSettings = defineCommand({
  id: "ticket-status.read-settings",
  title: "Ticket status",
  async run(ctx) {
    await migratePlannerStorage(ctx);
    return { statuses: sortedBySortOrder(await seedDefaultStatuses(ctx.storage)).map(toTicketStatusDraft) };
  },
});

export const saveStatusSettings = defineCommand({
  id: "ticket-status.save-settings",
  title: "Save ticket status settings",
  mutating: true,
  params: { statuses: { ...params.json<TicketStatusDraft[]>(), required: true } },
  async run(ctx, input) {
    if (!input.statuses) throw new Error("Statuses are required");
    const stored = await statusesCollection(ctx.storage).list();
    const storedById = new Map(stored.map((status) => [status.id, status]));
    const next = input.statuses.map((status) => toStoredStatus(status, storedById.get(status.id)));
    const nextIds = new Set(next.map((status) => status.id));
    const removed = stored.filter((status) => !nextIds.has(status.id));
    const fallbackId = (next.find((status) => status.isDefault) ?? next[0])?.id ?? null;

    await Promise.all([
      ...next.map((status) => putStatus(ctx.storage, status)),
      ...removed.map((status) => statusesCollection(ctx.storage).delete(status.id)),
      ...(await ticketsCollection(ctx.storage).list()).map((ticket) =>
        removed.some((status) => status.id === ticket.statusId)
          ? putTicket(ctx.storage, { ...ticket, statusId: fallbackId })
          : undefined,
      ),
    ]);
    await ctx.events.emit(plannerTicketsChanged, {});
    await ctx.events.emit(plannerSchemaChanged, {});

    return { statuses: sortedBySortOrder(next).map(toTicketStatusDraft) };
  },
});
