import type { WorkbenchModuleContribution } from "../../../../core";
import { dashboardViews } from "../../shared/mock-data/resources";
import { dashboardTickets } from "../../shared/mock-data/tickets";
import { dashboardWidgetIds } from "../../shared/widget-ids";
import { registerTicketKanbanRenderer } from "./collections/ticket-data";

// The tickets slice: the tickets board, its kanban renderer, and ticket routing.
export const createTicketsModule = (): WorkbenchModuleContribution => ({
  id: "dashboard.tickets",
  activate(ctx) {
    ctx.resources.registerProvider({
      id: "dashboard-workbench.tickets",
      kind: "ticket",
      list: () => dashboardTickets.map(({ resource }) => ({ resource, group: "Tickets" })),
    });

    registerTicketKanbanRenderer(ctx);

    ctx.views.registerView({
      id: dashboardViews.tickets.id,
      panelId: dashboardWidgetIds.tickets,
      title: dashboardViews.tickets.label,
      icon: dashboardViews.tickets.icon,
      resolveInput: (input) => {
        ctx.modes.setActiveMode("project");
        ctx.breadcrumbs.setItems([{ title: dashboardViews.tickets.label, icon: dashboardViews.tickets.icon }]);
        return input;
      },
    });
  },
});
