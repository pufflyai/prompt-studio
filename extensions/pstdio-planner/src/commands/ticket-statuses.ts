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
  title: "Read ticket statuses",
  cli: { globalAliases: [["statuses", "list"]], examples: ["pstdio statuses list"] },
  async run(ctx) {
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
  title: "Create ticket status",
  cli: { globalAliases: [["statuses", "create"]], examples: ["pstdio statuses create --label Backlog --color gray"] },
  params: {
    label: params.text({ label: "Label", required: true }),
    color: params.text({ label: "Color", required: false }),
    icon: params.text({ label: "Icon", required: false }),
    ...statusActionParams,
  },
  async run(ctx) {
    return createTicketStatus({
      storage: ctx.storage,
      name: ctx.params.label,
      color: ctx.params.color,
      icon: ctx.params.icon,
      canCreate: ctx.params.canCreate,
      canDragIn: ctx.params.canDragIn,
      canDragOut: ctx.params.canDragOut,
      columnActions: ctx.params.columnActions,
    });
  },
});

export const updateTicketStatusCommand = defineCommand({
  title: "Update ticket status",
  params: {
    statusId: params.text({ label: "Status", required: true }),
    label: params.text({ label: "Label", required: false }),
    color: params.text({ label: "Color", required: false }),
    icon: params.text({ label: "Icon", required: false }),
    sortOrder: params.number({ label: "Sort order", required: false }),
    ...statusActionParams,
  },
  async run(ctx) {
    return updateTicketStatus({
      storage: ctx.storage,
      statusId: ctx.params.statusId,
      name: ctx.params.label,
      color: ctx.params.color,
      icon: ctx.params.icon,
      sortOrder: ctx.params.sortOrder,
      canCreate: ctx.params.canCreate,
      canDragIn: ctx.params.canDragIn,
      canDragOut: ctx.params.canDragOut,
      columnActions: ctx.params.columnActions,
    });
  },
});

export const deleteTicketStatusCommand = defineCommand({
  title: "Delete ticket status",
  cli: { globalAliases: [["statuses", "delete"]], examples: ["pstdio statuses delete --status Ready"] },
  params: {
    statusId: params.text({ label: "Status", required: false }),
    status: params.text({ label: "Status name", required: false }),
  },
  async run(ctx) {
    const statusId = ctx.params.statusId ?? (await resolveStatusId(ctx.storage, ctx.params.status ?? ""));
    return deleteTicketStatus({ storage: ctx.storage, statusId });
  },
});

export const setDefaultTicketStatusCommand = defineCommand({
  title: "Set default ticket status",
  cli: { globalAliases: [["statuses", "set-default"]], examples: ["pstdio statuses set-default --status Ready"] },
  params: {
    status: params.text({ label: "Status", required: true }),
  },
  async run(ctx) {
    const statusId = await resolveStatusId(ctx.storage, ctx.params.status);
    return setDefaultStatus({ storage: ctx.storage, statusId });
  },
});

export const reorderTicketStatusesCommand = defineCommand({
  title: "Reorder ticket statuses",
  params: {
    statusIds: params.json<string[]>(),
  },
  async run(ctx) {
    return reorderTicketStatuses({ storage: ctx.storage, statusIds: ctx.params.statusIds ?? [] });
  },
});
