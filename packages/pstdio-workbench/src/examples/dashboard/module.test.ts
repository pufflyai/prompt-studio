import { describe, expect, test } from "bun:test";
import { createWorkbenchCore, getActiveWidgetId, type WorkbenchCore } from "../../core";
import { SETTINGS_RESOURCE_KIND } from "../../react";
import { createDashboardExampleModules } from "./module";
import { dashboardNavigationTreeViewId } from "./modules/shell/project-nav";
import { dashboardResources } from "./shared/mock-data/resources";
import { dashboardTickets } from "./shared/mock-data/tickets";
import { dashboardWidgetIds } from "./shared/widget-ids";

const createDashboardWorkbench = () => {
  const workbench = createWorkbenchCore();
  for (const module of createDashboardExampleModules()) workbench.registerModule(module);
  return workbench;
};

// After the unification, trees are placed via widgets. The "active" tree is the
// active widget in the left area whose rendererId matches a registered tree
// renderer.
const resolveLeftTreePlacementIds = (workbench: WorkbenchCore) => {
  const leftWidgets = workbench.layout.getLayout().areas.left?.widgets ?? [];
  return leftWidgets
    .map((placement) => workbench.layout.getWidget(placement.contributionId))
    .filter((widget): widget is NonNullable<typeof widget> => Boolean(widget))
    .filter((widget) => workbench.renderers.getTreeRenderer(widget.rendererId))
    .map((widget) => widget.id);
};

const resolveAreaPlacementIds = (
  workbench: WorkbenchCore,
  area: keyof ReturnType<WorkbenchCore["layout"]["getLayout"]>["areas"],
) => workbench.layout.getLayout().areas[area]?.widgets.map((placement) => placement.contributionId) ?? [];

describe("dashboard workbench navigation", () => {
  test("uses the standard resource icons", () => {
    const workbench = createDashboardWorkbench();

    expect(workbench.resources.getKind("project")?.icon).toBe("folder-root");
    expect(workbench.resources.getKind("dashboard-view")?.icon).toBe("square-kanban");
    expect(workbench.resources.getKind("ticket")?.icon).toBe("component");
    expect(workbench.resources.getKind("workspace")?.icon).toBe("computer");
    expect(workbench.resources.getKind(SETTINGS_RESOURCE_KIND)?.icon).toBe("settings");
    expect(dashboardResources.tickets.icon).toBe("square-kanban");
    expect(dashboardResources.workspaces.icon).toBe("computer");
    expect(dashboardResources.settings.icon).toBe("settings");
    expect(dashboardTickets[0]?.resource.icon).toBe("component");
    expect(dashboardTickets[0]?.workspaceResource.icon).toBe("git-pull-request-draft");
  });

  test("opens settings outside the frame without changing dashboard state", async () => {
    const workbench = createDashboardWorkbench();
    const layout = workbench.layout.getLayout();
    const modeId = workbench.modes.getActiveModeId();
    const activeResource = workbench.getActiveResource();

    // The merged navigation tree is the sole left-area tree, so no tabs render.
    expect(resolveLeftTreePlacementIds(workbench)).toEqual([dashboardNavigationTreeViewId]);

    await workbench.resources.openResource(dashboardResources.settings, { replaceActive: true });

    expect(workbench.settings.isOpen()).toBe(true);
    expect(workbench.layout.getLayout()).toBe(layout);
    expect(workbench.modes.getActiveModeId()).toBe(modeId);
    expect(workbench.getActiveResource()).toBe(activeResource);
    expect(resolveLeftTreePlacementIds(workbench)).toEqual([dashboardNavigationTreeViewId]);

    workbench.settings.close();

    expect(workbench.settings.isOpen()).toBe(false);
    expect(workbench.layout.getLayout()).toBe(layout);
    expect(workbench.modes.getActiveModeId()).toBe(modeId);
    expect(workbench.getActiveResource()).toBe(activeResource);
    expect(resolveLeftTreePlacementIds(workbench)).toEqual([dashboardNavigationTreeViewId]);
  });

  test("opens workspaces from a data view into the resource sidebar", async () => {
    const workbench = createDashboardWorkbench();

    await workbench.resources.openResource(dashboardResources.workspaces, { replaceActive: true });

    const workspaceRenderer = workbench.renderers.getDataRenderer(dashboardWidgetIds.workspaces);
    expect(workspaceRenderer).toBeDefined();
    expect(getActiveWidgetId(workbench.layout.getLayout())).toBe(dashboardWidgetIds.workspaces);

    await workbench.resources.openResource(dashboardTickets[0]!.workspaceResource, { replaceActive: true });

    expect(resolveAreaPlacementIds(workbench, "left")).toEqual([dashboardWidgetIds.ticketSidebar]);
    expect(resolveLeftTreePlacementIds(workbench)).toEqual([dashboardWidgetIds.ticketSidebar]);
    await expect(workbench.renderers.getBody(dashboardWidgetIds.ticketSidebar)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "resource",
          nodes: expect.arrayContaining([expect.objectContaining({ id: dashboardTickets[0]!.workspaceResource.uri })]),
        }),
      ]),
    );
    expect(getActiveWidgetId(workbench.layout.getLayout())).toBe(dashboardWidgetIds.workspace);
  });

  test("opens tickets into the resource sidebar with workspace links", async () => {
    const workbench = createDashboardWorkbench();
    const ticketRenderer = workbench.renderers.getDataRenderer(dashboardWidgetIds.tickets);
    const [ticketRow] = await Promise.resolve(
      ticketRenderer?.executeQuery({
        settings: {
          viewMode: "board",
          columnGrouping: "status",
          rowGrouping: "none",
          ordering: { attributeId: "updated", direction: "desc" },
          displayProperties: ["status"],
        },
        filters: {},
      }) ?? [],
    );

    expect(ticketRow).toBeDefined();
    if (!ticketRow) throw new Error("Expected a dashboard ticket row");
    ticketRenderer?.onRowClick?.(ticketRow);

    expect(resolveAreaPlacementIds(workbench, "left")).toEqual([dashboardWidgetIds.ticketSidebar]);
    expect(resolveLeftTreePlacementIds(workbench)).toEqual([dashboardWidgetIds.ticketSidebar]);
    expect(workbench.layout.getLayout().activeResourceUri).toBe(dashboardTickets[0]!.resource.uri);
    expect(workbench.renderers.getTreeState(dashboardWidgetIds.ticketSidebar).selectedNodeId).toBe(
      dashboardTickets[0]!.resource.uri,
    );

    await workbench.resources.openResource(dashboardTickets[0]!.workspaceResource, { replaceActive: true });

    expect(resolveAreaPlacementIds(workbench, "left")).toEqual([dashboardWidgetIds.ticketSidebar]);
    expect(resolveLeftTreePlacementIds(workbench)).toEqual([dashboardWidgetIds.ticketSidebar]);
    expect(workbench.layout.getLayout().activeResourceUri).toBe(dashboardTickets[0]!.workspaceResource.uri);
    expect(workbench.renderers.getTreeState(dashboardWidgetIds.ticketSidebar).selectedNodeId).toBe(
      dashboardTickets[0]!.workspaceResource.uri,
    );
  });

  test("re-derives the sidebar body and selection when the primary switches to a different ticket", async () => {
    const workbench = createDashboardWorkbench();
    // A non-index-0 ticket: resolveTicketForResource only falls back to dashboardTickets[0],
    // so targeting a different ticket proves the body actually follows the primary resource.
    const other = dashboardTickets[2];
    if (!other) throw new Error("Expected a second dashboard ticket");

    await workbench.resources.openResource(dashboardTickets[0]!.resource, { replaceActive: true });
    await workbench.resources.openResource(other.resource, { replaceActive: true });

    const body = await workbench.renderers.getBody(dashboardWidgetIds.ticketSidebar);
    const resourceSection = body.find((section) => section.id === "resource");
    const nodeIds = resourceSection?.nodes.map((node) => node.id) ?? [];

    expect(nodeIds).toContain(other.resource.uri);
    expect(nodeIds).not.toContain(dashboardTickets[0]!.resource.uri);
    expect(workbench.renderers.getTreeState(dashboardWidgetIds.ticketSidebar).selectedNodeId).toBe(other.resource.uri);
  });
});
