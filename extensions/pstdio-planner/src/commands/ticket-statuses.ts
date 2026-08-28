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

export const readTicketStatusesCommand = defineCommand({
  id: "ticketStatus.read",
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
  id: "ticketStatus.create",
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
    return createTicketStatus({
      storage: ctx.storage,
      name: commandParams.label,
      color: commandParams.color,
      icon: commandParams.icon,
      canCreate: commandParams.canCreate,
      canDragIn: commandParams.canDragIn,
      canDragOut: commandParams.canDragOut,
      columnActions: commandParams.columnActions,
    });
  },
});

export const updateTicketStatusCommand = defineCommand({
  id: "ticketStatus.update",
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
    return updateTicketStatus({
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
  },
});

export const deleteTicketStatusCommand = defineCommand({
  id: "ticketStatus.delete",
  mutating: true,
  title: "Delete ticket status",
  cli: { globalAliases: [["statuses", "delete"]], examples: ["pstdio statuses delete --status TODO"] },
  params: {
    statusId: params.text({ label: "Status", required: false }),
    status: params.text({ label: "Status name", required: false }),
  },
  async run(ctx, commandParams) {
    const statusId = commandParams.statusId ?? (await resolveStatusId(ctx.storage, commandParams.status ?? ""));
    return deleteTicketStatus({ storage: ctx.storage, statusId });
  },
});

export const setDefaultTicketStatusCommand = defineCommand({
  id: "ticketStatus.setDefault",
  mutating: true,
  title: "Set default ticket status",
  cli: { globalAliases: [["statuses", "set-default"]], examples: ["pstdio statuses set-default --status TODO"] },
  params: {
    status: params.text({ label: "Status", required: true }),
  },
  async run(ctx, commandParams) {
    const statusId = await resolveStatusId(ctx.storage, commandParams.status);
    return setDefaultStatus({ storage: ctx.storage, statusId });
  },
});

export const reorderTicketStatusesCommand = defineCommand({
  id: "ticketStatus.reorder",
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
    return reorderTicketStatuses({ storage: ctx.storage, statusIds: commandParams.statusIds ?? [] });
  },
});
