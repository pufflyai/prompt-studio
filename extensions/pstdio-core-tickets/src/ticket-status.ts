import type { ExtensionAttemptStatusesApi, ExtensionTicketStatusesApi } from "@pstdio/sdk/extensions";

const defaultTicketStatuses = [
  {
    name: "backlog",
    color: "gray",
    sortOrder: 10,
    isDefault: true,
    canCreate: true,
    canDragIn: true,
    canDragOut: true,
    columnActions: [],
  },
  {
    name: "ready",
    color: "green",
    sortOrder: 20,
    isDefault: false,
    canCreate: false,
    canDragIn: true,
    canDragOut: true,
    columnActions: [],
  },
  {
    name: "wip",
    color: "blue",
    sortOrder: 30,
    isDefault: false,
    canCreate: false,
    canDragIn: true,
    canDragOut: true,
    columnActions: [],
  },
  {
    name: "blocked",
    color: "red",
    sortOrder: 40,
    isDefault: false,
    canCreate: false,
    canDragIn: true,
    canDragOut: true,
    columnActions: [],
  },
  {
    name: "review",
    color: "amber",
    sortOrder: 50,
    isDefault: false,
    canCreate: false,
    canDragIn: true,
    canDragOut: true,
    columnActions: [],
  },
  {
    name: "done",
    color: "green",
    sortOrder: 60,
    isDefault: false,
    canCreate: false,
    canDragIn: true,
    canDragOut: true,
    columnActions: ["archive_all"],
  },
];

const defaultAttemptStatuses = [
  { name: "wip", color: "blue", sortOrder: 10, isDefault: true },
  { name: "blocked", color: "red", sortOrder: 20, isDefault: false },
  { name: "review-ready", color: "amber", sortOrder: 30, isDefault: false },
  { name: "reviewed", color: "green", sortOrder: 40, isDefault: false },
  { name: "changes-requested", color: "orange", sortOrder: 50, isDefault: false },
];

export const ensureDefaultTicketAutomationSetup = async (ctx: {
  attemptStatuses: ExtensionAttemptStatusesApi;
  ticketStatuses: ExtensionTicketStatusesApi;
}) => {
  const ticketStatuses = await ctx.ticketStatuses.list();
  for (const status of defaultTicketStatuses) {
    const existing = ticketStatuses.find((candidate) => candidate.name === status.name);
    if (!existing) {
      await ctx.ticketStatuses.create(status);
      continue;
    }

    await ctx.ticketStatuses.update({ statusId: existing.id, ...status });
    if (status.isDefault) await ctx.ticketStatuses.setDefault({ statusId: existing.id });
  }

  const attemptStatuses = await ctx.attemptStatuses.list();
  for (const status of defaultAttemptStatuses) {
    const existing = attemptStatuses.find((candidate) => candidate.name === status.name);
    if (existing) {
      await ctx.attemptStatuses.update({ statusId: existing.id, ...status });
      continue;
    }

    await ctx.attemptStatuses.create(status);
  }
};

export const reorderTicketStatuses = async (input: {
  statusIds: string[];
  ticketStatuses: ExtensionTicketStatusesApi;
}) => {
  for (const [index, statusId] of input.statusIds.entries()) {
    await input.ticketStatuses.update({ statusId, sortOrder: (index + 1) * 10 });
  }

  return { statuses: await input.ticketStatuses.list() };
};
