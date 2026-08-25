import {
  type ResourceRef,
  standardResourceIcons,
  type WorkbenchModuleContext,
  type WorkbenchModuleContribution,
} from "../../../../core";
import { dashboardViews } from "../../shared/mock-data/resources";
import { dashboardTickets } from "../../shared/mock-data/tickets";
import { syncResourceSidenav } from "../../shared/resource-sync";
import { dashboardWidgetIds } from "../../shared/widget-ids";
import { registerWorkspaceKanbanRenderer } from "./collections/workspace-kanban-renderer";
import { WorkspaceWidget } from "./components/workspace-widget";
import { registerResourceSidenavTree } from "./resource-sidenav-tree";

const resolveTicket = (resource: ResourceRef) =>
  dashboardTickets.find((ticket) => ticket.id === resource.id) ?? dashboardTickets[0];

// A ticket or workspace opens into the workspace detail view; its breadcrumb
// trail walks back up to the board it belongs to.
const setDetailBreadcrumbs = (ctx: WorkbenchModuleContext, resource: ResourceRef) => {
  if (resource.kind === "ticket") {
    const ticket = resolveTicket(resource);
    ctx.breadcrumbs.setItems([
      {
        title: "Tickets",
        icon: dashboardViews.tickets.icon,
        onClick: () => void ctx.views.openView(dashboardViews.tickets.id, { strategy: { kind: "replace-active" } }),
      },
      { title: `${ticket.id} ${ticket.title}`, icon: ticket.resource.icon, resource: ticket.resource },
      {
        title: `Attempt ${ticket.workspace.shorthand}`,
        icon: ticket.workspaceResource.icon,
        resource: ticket.workspaceResource,
      },
    ]);
    return;
  }

  ctx.breadcrumbs.setItems([
    {
      title: "Workspaces",
      icon: dashboardViews.workspaces.icon,
      onClick: () => void ctx.views.openView(dashboardViews.workspaces.id, { strategy: { kind: "replace-active" } }),
    },
    { title: resource.label ?? "Workspace", icon: resource.icon ?? standardResourceIcons.workspace, resource },
  ]);
};

const registerWorkspaceDetailWidget = (ctx: WorkbenchModuleContext) => {
  ctx.layout.registerPanel(
    {
      id: dashboardWidgetIds.workspace,
      title: "Workspace",
      region: "main",
      singleton: true,
      rendererId: dashboardWidgetIds.workspace,
      priority: 80,
    },
    { priority: 80 },
  );
  ctx.renderers.registerRenderer({ id: dashboardWidgetIds.workspace, render: () => <WorkspaceWidget /> });
};

// The workspaces slice: the workspaces board, the per-attempt workspace detail
// view, and the resource sidenav that ticket/workspace resources open into.
export const createWorkspacesModule = (): WorkbenchModuleContribution => ({
  id: "dashboard.workspaces",
  activate(ctx) {
    registerWorkspaceKanbanRenderer(ctx);
    registerWorkspaceDetailWidget(ctx);
    registerResourceSidenavTree(ctx);

    // The resource sidenav follows the primary (main) resource: when a ticket/workspace
    // becomes primary, re-derive its body and select the matching node. Fires after the
    // detail widget lands in main, so the sidenav always reflects the current primary.
    // The context-wrapped subscription is tracked with the module, so we don't return it.
    ctx.onDidChangePrimaryResource((resource) => {
      if (resource?.kind !== "ticket" && resource?.kind !== "workspace") return;
      ctx.renderers.setSelectedNode(dashboardWidgetIds.ticketSidenav, resource.uri);
      ctx.renderers.refresh(dashboardWidgetIds.ticketSidenav);
    });

    ctx.resources.registerProvider({
      id: "dashboard-workbench.workspaces",
      kind: "workspace",
      list: () =>
        dashboardTickets.map(({ workspaceResource }) => ({ resource: workspaceResource, group: "Workspaces" })),
    });

    ctx.views.registerView({
      id: dashboardViews.workspaces.id,
      panelId: dashboardWidgetIds.workspaces,
      title: dashboardViews.workspaces.label,
      icon: dashboardViews.workspaces.icon,
      resolveInput: (input) => {
        ctx.modes.setActiveMode("project");
        ctx.breadcrumbs.setItems([{ title: dashboardViews.workspaces.label, icon: dashboardViews.workspaces.icon }]);
        return input;
      },
    });

    ctx.resources.registerPresenter({
      id: "dashboard.workspaces.presenter",
      priority: 1000,
      canOpen: (resource) => resource.kind === "workspace" || resource.kind === "ticket",
      open: (resource, input) => {
        ctx.modes.setActiveMode(undefined);
        syncResourceSidenav(ctx, resource);
        setDetailBreadcrumbs(ctx, resource);
        return ctx.layout.openPanel(dashboardWidgetIds.workspace, {
          strategy: input.replaceActive ? { kind: "replace-active" } : { kind: "persistent" },
          resource,
          title: resource.label,
        });
      },
    });
  },
});
