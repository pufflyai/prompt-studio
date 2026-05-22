import type { ResourceRef, WorkbenchModuleContributionContext } from "../../../../../core";
import { dashboardCollectionsProjectId } from "../../../shared/mock-data/resources";
import { dashboardStatusColumns, dashboardTickets, dashboardTicketTags } from "../../../shared/mock-data/tickets";
import { dashboardWidgetIds } from "../../../shared/widget-ids";

const columnConfigById = new Map(
  dashboardStatusColumns.map((column) => [
    column.id,
    { color: column.color, canDragIn: true, canDragOut: column.id !== "done", canCreate: column.id !== "done" },
  ]),
);

const toDataRow = (ticket: (typeof dashboardTickets)[number]) => ({
  ...ticket,
  title: `${ticket.id} ${ticket.title}`,
});

// The tickets board is a workbench data renderer so saved-view application and
// the SavedViewMenu come from the workbench data-renderer primitive.
export const registerTicketDataRenderer = (ctx: WorkbenchModuleContributionContext) => {
  ctx.renderers.registerDataRenderer({
    id: dashboardWidgetIds.tickets,
    title: "Tickets",
    resourceKind: "ticket",
    tagDefinitions: dashboardTicketTags,
    knownColumnKeys: dashboardStatusColumns.map((column) => column.id),
    getBoardColumnConfig: (groupKey) =>
      columnConfigById.get(groupKey) ?? { color: "gray", canDragIn: true, canDragOut: true, canCreate: true },
    executeQuery: () => dashboardTickets.map(toDataRow),
    onTicketClick: (row) => {
      const resource = (row as { resource?: ResourceRef }).resource;
      if (resource) void ctx.resources.openResource(resource, { replaceActive: true });
    },
    onCreateTicket: (columnId) => ctx.notifications.show({ level: "info", title: `Create ticket in ${columnId}` }),
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
