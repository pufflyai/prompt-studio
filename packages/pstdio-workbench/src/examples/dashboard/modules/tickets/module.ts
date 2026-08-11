import type { WorkbenchModuleContribution } from "../../../../core";
import { dashboardTickets } from "../../shared/mock-data/tickets";
import { setResourceBreadcrumb } from "../../shared/resource-sync";
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

    ctx.resources.registerPresenter({
      id: "dashboard.tickets.presenter",
      priority: 1000,
      canOpen: (resource) => resource.kind === "dashboard-view" && resource.id === "tickets",
      open: (resource, input) => {
        ctx.modes.setActiveMode("project");
        setResourceBreadcrumb(ctx, resource);
        return ctx.layout.openPanel(dashboardWidgetIds.tickets, {
          strategy: input.replaceActive ? { kind: "replace-active" } : { kind: "persistent" },
          resource,
          title: resource.label,
        });
      },
    });
  },
});
