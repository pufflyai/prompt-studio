import { defineCommand, params } from "@pstdio/sdk/extensions";
import {
  createTicketStatus,
  deleteTicketStatus,
  readTicketStatuses,
  reorderTicketStatuses,
  updateTicketStatus,
} from "../data/status-operations";

export const readTicketStatusesCommand = defineCommand({
  title: "Read ticket statuses",
  description: "Read the ticket board status definitions.",
  async run(ctx) {
    return readTicketStatuses(ctx.storage);
  },
});

export const createTicketStatusCommand = defineCommand({
  title: "Create ticket status",
  description: "Create a ticket board status definition.",
  params: {
    label: params.text({ label: "Label", required: true }),
    color: params.text({ label: "Color", required: false }),
  },
  async run(ctx) {
    return createTicketStatus({ storage: ctx.storage, name: ctx.params.label, color: ctx.params.color });
  },
});

export const updateTicketStatusCommand = defineCommand({
  title: "Update ticket status",
  description: "Update a ticket board status definition.",
  params: {
    statusId: params.text({ label: "Status", required: true }),
    label: params.text({ label: "Label", required: false }),
    color: params.text({ label: "Color", required: false }),
  },
  async run(ctx) {
    return updateTicketStatus({
      storage: ctx.storage,
      statusId: ctx.params.statusId,
      name: ctx.params.label,
      color: ctx.params.color,
    });
  },
});

export const deleteTicketStatusCommand = defineCommand({
  title: "Delete ticket status",
  description: "Delete a ticket board status definition.",
  params: {
    statusId: params.text({ label: "Status", required: true }),
  },
  async run(ctx) {
    return deleteTicketStatus({ storage: ctx.storage, statusId: ctx.params.statusId });
  },
});

export const reorderTicketStatusesCommand = defineCommand({
  title: "Reorder ticket statuses",
  description: "Reorder the ticket board status definitions.",
  params: {
    statusIds: params.json<string[]>(),
  },
  async run(ctx) {
    return reorderTicketStatuses({ storage: ctx.storage, statusIds: ctx.params.statusIds ?? [] });
  },
});
