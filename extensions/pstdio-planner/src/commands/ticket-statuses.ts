import { defineCommand, params } from "@pstdio/sdk/extensions";
import { resolveStatusId } from "../data/resolve";
import {
  createTicketStatus,
  deleteTicketStatus,
  readTicketStatuses,
  reorderTicketStatuses,
  setDefaultStatus,
  updateTicketStatus,
} from "../data/status-operations";
import { plannerTicketsChanged } from "../events";

export const readTicketStatusesCommand = defineCommand({
  id: "ticket-status.read",
  title: "Read ticket statuses",
  cli: { globalAliases: [["statuses", "list"]], examples: ["pstdio statuses list"] },
  async run(ctx, _commandParams) {
    return readTicketStatuses(ctx.storage);
  },
});

const statusActionParams = {
  canCreate: params.boolean({ label: "Allow creating tickets", required: false }),
  canDragIn: params.boolean({ label: "Allow dragging tickets in", required: false }),
  canDragOut: params.boolean({ label: "Allow dragging tickets out", required: false }),
  columnActions: params.json<string[]>(),
};

export const createTicketStatusCommand = defineCommand({
  id: "ticket-status.create",
  mutating: true,
  title: "Create ticket status",
  cli: { globalAliases: [["statuses", "create"]], examples: ["pstdio statuses create --label Backlog --color gray"] },
  params: {
    label: params.text({ label: "Label", required: true }),
    color: params.text({ label: "Color", required: false }),
    icon: params.text({ label: "Icon", required: false }),
    ...statusActionParams,
  },
  async run(ctx, commandParams) {
    const status = await createTicketStatus({
      storage: ctx.storage,
      name: commandParams.label,
      color: commandParams.color,
      icon: commandParams.icon,
      canCreate: commandParams.canCreate,
      canDragIn: commandParams.canDragIn,
      canDragOut: commandParams.canDragOut,
      columnActions: commandParams.columnActions,
    });
    await ctx.events.emit(plannerTicketsChanged, {});
    return status;
  },
});

export const updateTicketStatusCommand = defineCommand({
  id: "ticket-status.update",
  mutating: true,
  title: "Update ticket status",
  cli: {
    globalAliases: [["statuses", "update"]],
    examples: ["pstdio statuses update --status-id backlog --label Backlog"],
  },
  params: {
    statusId: params.text({ label: "Status", required: true }),
    label: params.text({ label: "Label", required: false }),
    color: params.text({ label: "Color", required: false }),
    icon: params.text({ label: "Icon", required: false }),
    sortOrder: params.number({ label: "Sort order", required: false }),
    ...statusActionParams,
  },
  async run(ctx, commandParams) {
    const status = await updateTicketStatus({
      storage: ctx.storage,
      statusId: commandParams.statusId,
      name: commandParams.label,
      color: commandParams.color,
      icon: commandParams.icon,
      sortOrder: commandParams.sortOrder,
      canCreate: commandParams.canCreate,
      canDragIn: commandParams.canDragIn,
      canDragOut: commandParams.canDragOut,
      columnActions: commandParams.columnActions,
    });
    await ctx.events.emit(plannerTicketsChanged, {});
    return status;
  },
});

export const deleteTicketStatusCommand = defineCommand({
  id: "ticket-status.delete",
  mutating: true,
  title: "Delete ticket status",
  cli: { globalAliases: [["statuses", "delete"]], examples: ["pstdio statuses delete --status TODO"] },
  params: {
    statusId: params.text({ label: "Status", required: false }),
    status: params.text({ label: "Status name", required: false }),
  },
  async run(ctx, commandParams) {
    const statusId = commandParams.statusId ?? (await resolveStatusId(ctx.storage, commandParams.status ?? ""));
    const result = await deleteTicketStatus({ storage: ctx.storage, statusId });
    await ctx.events.emit(plannerTicketsChanged, {});
    return result;
  },
});

export const setDefaultTicketStatusCommand = defineCommand({
  id: "ticket-status.set-default",
  mutating: true,
  title: "Set default ticket status",
  cli: { globalAliases: [["statuses", "set-default"]], examples: ["pstdio statuses set-default --status TODO"] },
  params: {
    status: params.text({ label: "Status", required: true }),
  },
  async run(ctx, commandParams) {
    const statusId = await resolveStatusId(ctx.storage, commandParams.status);
    const result = await setDefaultStatus({ storage: ctx.storage, statusId });
    await ctx.events.emit(plannerTicketsChanged, {});
    return result;
  },
});

export const reorderTicketStatusesCommand = defineCommand({
  id: "ticket-status.reorder",
  mutating: true,
  title: "Reorder ticket statuses",
  cli: {
    globalAliases: [["statuses", "reorder"]],
    examples: ['pstdio statuses reorder --status-ids \'["backlog","ready"]\''],
  },
  params: {
    statusIds: params.json<string[]>(),
  },
  async run(ctx, commandParams) {
    const result = await reorderTicketStatuses({ storage: ctx.storage, statusIds: commandParams.statusIds ?? [] });
    await ctx.events.emit(plannerTicketsChanged, {});
    return result;
  },
});
