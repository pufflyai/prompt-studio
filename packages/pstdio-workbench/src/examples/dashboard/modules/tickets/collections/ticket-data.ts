import type { AttributeDescriptor, KanbanRendererRow } from "@pstdio/ui/kanban-renderer";
import type { ResourceRef, WorkbenchModuleContext } from "../../../../../core";
import { dashboardStatusColumns, dashboardTickets, dashboardTicketTags } from "../../../shared/mock-data/tickets";
import { dashboardWidgetIds } from "../../../shared/widget-ids";

interface TicketRow extends KanbanRendererRow {
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

// The tickets board is a workbench kanban renderer so filter, grouping, and
// display controls stay local to the widget.
export const registerTicketKanbanRenderer = (ctx: WorkbenchModuleContext) => {
  ctx.renderers.registerKanbanRenderer<TicketRow>({
    id: dashboardWidgetIds.tickets,
    title: "Tickets",
    resourceKind: "ticket",
    attributes: ticketAttributes,
    getBoardColumnConfig: (groupKey) =>
      columnConfigById.get(groupKey) ?? { color: "gray", canDragIn: true, canDragOut: true, canCreate: true },
    executeQuery: () => dashboardTickets.map(toTicketRow),
    onRowActivate: (row) => {
      if (row.resource) void ctx.resources.openResource(row.resource, { replaceActive: true });
    },
    createRow: {
      title: "New ticket",
      submitLabel: "Create ticket",
      fields: [
        {
          id: "content",
          label: "Description",
          placeholder: "Describe the ticket...",
          type: "markdown",
          required: true,
        },
        { id: "files", label: "Attach files", type: "files", multiple: true },
      ],
      labels: {
        cancel: "Cancel",
        properties: "Properties",
        submitError: "Could not create ticket",
        removeFile: "Remove file",
      },
    },
    onCreateRow: (submission) => {
      ctx.notifications.show({ level: "info", title: `Create ticket in ${submission.columnId}` });
    },
  });
  ctx.layout.registerPanel(
    {
      closable: false,
      id: dashboardWidgetIds.tickets,
      title: "Tickets",
      region: "main",
      rendererId: dashboardWidgetIds.tickets,
      resourceKinds: ["dashboard-view"],
      singleton: true,
    },
    { priority: 90 },
  );
};
