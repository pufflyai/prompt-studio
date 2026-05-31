import type { ResourceRef, WorkbenchModuleContribution, WorkbenchModuleContributionContext } from "../../../../core";
import { dashboardResources } from "../../shared/mock-data/resources";
import { dashboardTickets } from "../../shared/mock-data/tickets";
import { setResourceBreadcrumb, syncResourceSidebar } from "../../shared/resource-sync";
import { dashboardWidgetIds } from "../../shared/widget-ids";
import { registerWorkspaceDataRenderer } from "./collections/workspace-data-renderer";
import { WorkspaceWidget } from "./components/workspace-widget";
import { registerResourceSidebarTree } from "./resource-sidebar-tree";

const resolveTicket = (resource: ResourceRef) =>
  dashboardTickets.find((ticket) => ticket.id === resource.id) ?? dashboardTickets[0];

// A ticket or workspace opens into the workspace detail view; its breadcrumb
// trail walks back up to the board it belongs to.
const setDetailBreadcrumbs = (ctx: WorkbenchModuleContributionContext, resource: ResourceRef) => {
  if (resource.kind === "ticket") {
    const ticket = resolveTicket(resource);
    ctx.breadcrumbs.setItems([
      {
        title: "Tickets",
        icon: "KanbanSquare",
        resource: dashboardResources.tickets,
        onClick: () => void ctx.resources.openResource(dashboardResources.tickets, { replaceActive: true }),
      },
      { title: `${ticket.id} ${ticket.title}`, icon: "Ticket", resource: ticket.resource },
      { title: `Attempt ${ticket.workspace.shorthand}`, icon: "GitBranch", resource: ticket.workspaceResource },
    ]);
    return;
  }

  ctx.breadcrumbs.setItems([
    {
      title: "Workspaces",
      icon: "GitBranch",
      resource: dashboardResources.workspaces,
      onClick: () => void ctx.resources.openResource(dashboardResources.workspaces, { replaceActive: true }),
    },
    { title: resource.label ?? "Workspace", icon: "GitBranch", resource },
  ]);
};

const registerWorkspaceDetailWidget = (ctx: WorkbenchModuleContributionContext) => {
  ctx.layout.registerWidget(
    {
      id: dashboardWidgetIds.workspace,
      title: "Workspace",
      area: "main",
      singleton: true,
      rendererId: dashboardWidgetIds.workspace,
      priority: 80,
    },
    { priority: 80 },
  );
  ctx.renderers.registerRenderer({ id: dashboardWidgetIds.workspace, render: () => <WorkspaceWidget /> });
};

// The workspaces slice: the workspaces board, the per-attempt workspace detail
// view, and the resource sidebar that ticket/workspace resources open into.
export const createWorkspacesModule = (): WorkbenchModuleContribution => ({
  id: "dashboard.workspaces",
  activate(ctx) {
    registerWorkspaceDataRenderer(ctx);
    registerWorkspaceDetailWidget(ctx);
    registerResourceSidebarTree(ctx);

    // The resource sidebar follows the primary (main) resource: when a ticket/workspace
    // becomes primary, re-derive its body and select the matching node. Fires after the
    // detail widget lands in main, so the sidebar always reflects the current primary.
    // The context-wrapped subscription is tracked with the module, so we don't return it.
    ctx.onDidChangePrimaryResource((resource) => {
      if (resource?.kind !== "ticket" && resource?.kind !== "workspace") return;
      ctx.renderers.setSelectedNode(dashboardWidgetIds.ticketSidebar, resource.uri);
      ctx.renderers.refresh(dashboardWidgetIds.ticketSidebar);
    });

    ctx.resources.registerProvider({
      id: "dashboard-workbench.workspaces",
      kind: "workspace",
      list: () =>
        dashboardTickets.map(({ workspaceResource }) => ({ resource: workspaceResource, group: "Workspaces" })),
    });

    ctx.resources.registerOpener({
      id: "dashboard.workspaces.opener",
      priority: 1000,
      canOpen: (resource) =>
        (resource.kind === "dashboard-view" && resource.id === "workspaces") ||
        resource.kind === "workspace" ||
        resource.kind === "ticket",
      open: (resource, input) => {
        if (resource.kind === "dashboard-view") {
          ctx.modes.setActiveMode("project");
          setResourceBreadcrumb(ctx, resource);
          return ctx.layout.openWidget(dashboardWidgetIds.workspaces, {
            resource,
            title: resource.label,
            replaceActive: input.replaceActive,
          });
        }

        ctx.modes.setActiveMode(undefined);
        syncResourceSidebar(ctx, resource);
        setDetailBreadcrumbs(ctx, resource);
        return ctx.layout.openWidget(dashboardWidgetIds.workspace, {
          resource,
          title: resource.label,
          replaceActive: input.replaceActive,
        });
      },
    });
  },
});
