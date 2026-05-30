import type { WorkbenchModuleContribution } from "../../../../core";
import { dashboardTickets } from "../../shared/mock-data/tickets";
import { setResourceBreadcrumb } from "../../shared/resource-sync";
import { dashboardWidgetIds } from "../../shared/widget-ids";
import { registerTicketDataRenderer } from "./collections/ticket-data";

// The tickets slice: the tickets board, its data renderer, and ticket routing.
export const createTicketsModule = (): WorkbenchModuleContribution => ({
  id: "dashboard.tickets",
  activate(ctx) {
    ctx.resources.registerProvider({
      id: "dashboard-workbench.tickets",
      kind: "ticket",
      list: () => dashboardTickets.map(({ resource }) => ({ resource, group: "Tickets" })),
    });

    registerTicketDataRenderer(ctx);

    ctx.resources.registerOpener({
      id: "dashboard.tickets.opener",
      priority: 1000,
      canOpen: (resource) => resource.kind === "dashboard-view" && resource.id === "tickets",
      open: (resource, input) => {
        ctx.modes.setActiveMode("project");
        setResourceBreadcrumb(ctx, resource);
        return ctx.layout.openWidget(dashboardWidgetIds.tickets, {
          resource,
          title: resource.label,
          replaceActive: input.replaceActive,
        });
      },
    });
  },
});
