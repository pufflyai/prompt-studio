import { defineStatuses, type WorkflowStatus } from "@pstdio/sdk/extensions";
import { cleanupLegacyWorkspaceStatus } from "./data/cleanup-legacy-workspace-status";
import { putStatus, putTicket, statusesCollection, ticketsCollection } from "./data/collections";
import { seedDefaultStatuses } from "./data/seed";
import type { StoredStatus } from "./data/types";
import { plannerTicketsChanged } from "./events";
import { sortedBySortOrder } from "./utils/sort";

const toWorkflowStatus = (status: StoredStatus): WorkflowStatus => ({
  id: status.id,
  label: status.name,
  color: status.color,
  icon: status.icon,
  sortOrder: status.sortOrder,
  isDefault: status.isDefault,
  actions: status.columnActions,
});

const toStoredStatus = (status: WorkflowStatus, stored: StoredStatus | undefined): StoredStatus => ({
  id: status.id,
  name: status.label,
  color: status.color,
  icon: status.icon ?? null,
  sortOrder: status.sortOrder,
  isDefault: status.isDefault ?? false,
  canCreate: stored?.canCreate ?? false,
  canDragIn: stored?.canDragIn ?? true,
  canDragOut: stored?.canDragOut ?? true,
  columnActions: [...(status.actions ?? [])],
});

export const ticketStatuses = defineStatuses({
  id: "ticket-statuses",
  title: "Ticket status",
  actions: [{ id: "archive_all", label: "Archive all", icon: "archive" }],
  async query(ctx) {
    await cleanupLegacyWorkspaceStatus(ctx.storage);
    return { statuses: sortedBySortOrder(await seedDefaultStatuses(ctx.storage)).map(toWorkflowStatus) };
  },
  async save(ctx, input) {
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

    return { statuses: sortedBySortOrder(next).map(toWorkflowStatus) };
  },
});
