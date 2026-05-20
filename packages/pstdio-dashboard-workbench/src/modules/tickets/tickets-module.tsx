import { type WorkbenchModuleContribution, workbenchCommandPaletteMenuPath } from "pstdio-workbench/core";
import { dashboardCommandIds, dashboardWidgetIds } from "@/services/workbench/ids";
import { openSurfaceWidget } from "@/services/workbench/module-helpers";
import { dashboardResourceKindIds, dashboardViewResource } from "@/services/workbench/resources/resource-kinds";
import { TicketDetail } from "./renderers/ticket-detail";
import { TicketsBoard } from "./renderers/tickets-board";

// Tickets surface: a status board plus per-ticket detail tabs, both backed by
// the live `tickets` collection.
export const createTicketsModule = (projectId: string): WorkbenchModuleContribution => ({
  id: "pstdio-dashboard-workbench.tickets",
  activate(ctx) {
    ctx.resources.registerKind({ kind: dashboardResourceKindIds.ticket, label: "Ticket", icon: "Ticket" });

    ctx.renderers.registerRenderer({
      id: dashboardWidgetIds.ticketsBoard,
      render: (input) => <TicketsBoard input={input} projectId={projectId} />,
    });
    ctx.renderers.registerRenderer({
      id: dashboardWidgetIds.ticketDetail,
      render: (input) => <TicketDetail input={input} projectId={projectId} />,
    });

    ctx.layout.registerWidget({
      id: dashboardWidgetIds.ticketsBoard,
      title: "Tickets",
      area: "main",
      singleton: true,
      rendererId: dashboardWidgetIds.ticketsBoard,
    });
    ctx.layout.registerWidget({
      id: dashboardWidgetIds.ticketDetail,
      title: "Ticket",
      area: "main",
      closable: true,
      rendererId: dashboardWidgetIds.ticketDetail,
      resourceKinds: [dashboardResourceKindIds.ticket],
    });

    ctx.resources.registerOpener({
      id: "pstdio-dashboard-workbench.tickets.opener",
      canOpen: (resource) =>
        resource.kind === dashboardResourceKindIds.ticket ||
        (resource.kind === dashboardResourceKindIds.dashboardView && resource.id === "tickets"),
      open: (resource, input) =>
        openSurfaceWidget(
          ctx,
          resource.kind === dashboardResourceKindIds.ticket
            ? dashboardWidgetIds.ticketDetail
            : dashboardWidgetIds.ticketsBoard,
          resource,
          input,
        ),
    });

    ctx.commands.registerCommand(
      { id: dashboardCommandIds.openTickets, label: "Open tickets", category: "Dashboard", icon: "Ticket" },
      { execute: () => ctx.resources.openResource(dashboardViewResource("tickets"), { replaceActive: true }) },
    );
    ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
      commandId: dashboardCommandIds.openTickets,
      order: 10,
    });
  },
});
