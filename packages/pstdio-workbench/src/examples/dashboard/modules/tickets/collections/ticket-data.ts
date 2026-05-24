import type { AttributeDescriptor, DataRendererRow } from "@pstdio/ui";
import type { ResourceRef, WorkbenchModuleContributionContext } from "../../../../../core";
import { dashboardCollectionsProjectId } from "../../../shared/mock-data/resources";
import { dashboardStatusColumns, dashboardTickets, dashboardTicketTags } from "../../../shared/mock-data/tickets";
import { dashboardWidgetIds } from "../../../shared/widget-ids";

interface TicketRow extends DataRendererRow {
  resource?: ResourceRef;
  attributes: {
    status: string;
    assignee: string;
    updated: string;
    [tagName: string]: unknown;
  };
}

const columnConfigById = new Map(
  dashboardStatusColumns.map((column) => [
    column.id,
    { color: column.color, canDragIn: true, canDragOut: column.id !== "done", canCreate: column.id !== "done" },
  ]),
);

const ticketAttributes: AttributeDescriptor[] = [
  {
    id: "status",
    label: "Status",
    type: {
      kind: "enum",
      options: dashboardStatusColumns.map((column) => ({ value: column.id, label: column.label, color: column.color })),
    },
    filterable: true,
    groupable: true,
    sortable: true,
    displayable: true,
  },
  {
    id: "assignee",
    label: "Assignee",
    type: { kind: "user" },
    filterable: true,
    groupable: true,
    displayable: true,
  },
  {
    id: "updated",
    label: "Updated",
    type: { kind: "date" },
    sortable: true,
    displayable: true,
  },
  ...dashboardTicketTags.map((tag) => ({
    id: tag.name,
    label: tag.label,
    type: {
      kind: "enum" as const,
      options: tag.options.map((option) => ({ value: option.value, label: option.label, color: option.color })),
    },
    filterable: true,
    groupable: true,
    displayable: true,
  })),
];

const toTicketRow = (ticket: (typeof dashboardTickets)[number]): TicketRow => {
  const tagAttributes: Record<string, string> = {};
  for (const tag of ticket.tags) tagAttributes[tag.name] = tag.value;

  return {
    id: ticket.id,
    title: `${ticket.id} ${ticket.title}`,
    resource: ticket.resource,
    attributes: {
      status: ticket.status,
      assignee: ticket.assignee,
      updated: ticket.updatedAt,
      ...tagAttributes,
    },
  };
};

// The tickets board is a workbench data renderer so saved-view application and
// the SavedViewMenu come from the workbench data-renderer primitive.
export const registerTicketDataRenderer = (ctx: WorkbenchModuleContributionContext) => {
  ctx.renderers.registerDataRenderer<TicketRow>({
    id: dashboardWidgetIds.tickets,
    title: "Tickets",
    resourceKind: "ticket",
    attributes: ticketAttributes,
    getBoardColumnConfig: (groupKey) =>
      columnConfigById.get(groupKey) ?? { color: "gray", canDragIn: true, canDragOut: true, canCreate: true },
    executeQuery: () => dashboardTickets.map(toTicketRow),
    onRowClick: (row) => {
      if (row.resource) void ctx.resources.openResource(row.resource, { replaceActive: true });
    },
    onCreateRow: (columnId) => ctx.notifications.show({ level: "info", title: `Create ticket in ${columnId}` }),
    savedViews: { resourceKind: "ticket", scope: "project", projectId: dashboardCollectionsProjectId },
  });
  ctx.layout.registerWidget(
    {
      id: dashboardWidgetIds.tickets,
      title: "Tickets",
      area: "main",
      rendererId: dashboardWidgetIds.tickets,
      resourceKinds: ["savedView"],
      singleton: true,
    },
    { priority: 90 },
  );
};
