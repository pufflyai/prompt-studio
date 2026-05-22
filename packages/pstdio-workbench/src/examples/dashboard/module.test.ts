import { describe, expect, test } from "bun:test";
import { createWorkbenchCore, type WorkbenchCore } from "../../core";
import { createDashboardExampleModules } from "./module";
import { dashboardSettingsNavigationTreeViewId } from "./modules/settings/settings-nav";
import { dashboardNavigationTreeViewId } from "./modules/shell/project-nav";
import { createSavedViewResource } from "./modules/tickets/collections/saved-view-resources";
import { filtersToExpression, settingsToDisplay } from "./modules/tickets/collections/ticket-view-mapping";
import { dashboardCollectionsProjectId, dashboardResources } from "./shared/mock-data/resources";
import { dashboardTickets } from "./shared/mock-data/tickets";
import { dashboardWidgetIds } from "./shared/widget-ids";

// Built without collection persistence so each test gets isolated saved views
// and favorites; the persisted adapter shares module-global storage.
const createDashboardWorkbench = () => {
  const workbench = createWorkbenchCore();
  for (const module of createDashboardExampleModules()) workbench.registerModule(module);
  return workbench;
};

// After the unification, trees are placed via widgets. The "active" tree is the
// active widget in the left area whose rendererId matches a registered tree
// renderer.
const resolveLeftTreePlacementIds = (workbench: WorkbenchCore) => {
  const leftWidgets = workbench.layout.getLayout().areas.left.widgets;
  return leftWidgets
    .map((placement) => workbench.layout.getWidget(placement.contributionId))
    .filter((widget): widget is NonNullable<typeof widget> => Boolean(widget))
    .filter((widget) => workbench.renderers.getTreeRenderer(widget.rendererId))
    .map((widget) => widget.id);
};

const resolveAreaPlacementIds = (
  workbench: WorkbenchCore,
  area: keyof ReturnType<WorkbenchCore["layout"]["getLayout"]>["areas"],
) => workbench.layout.getLayout().areas[area].widgets.map((placement) => placement.contributionId);

describe("dashboard workbench navigation", () => {
  test("switches the sidebar between project views and settings", async () => {
    const workbench = createDashboardWorkbench();

    // The merged navigation tree is the sole left-area tree, so no tabs render.
    expect(resolveLeftTreePlacementIds(workbench)).toEqual([dashboardNavigationTreeViewId]);

    await workbench.resources.openResource(dashboardResources.settings, { replaceActive: true });

    expect(workbench.modes.getActiveModeId()).toBe("settings");
    expect(resolveLeftTreePlacementIds(workbench)).toContain(dashboardSettingsNavigationTreeViewId);

    await workbench.resources.openResource(dashboardResources.tickets, { replaceActive: true });

    expect(workbench.modes.getActiveModeId()).toBe("project");
    expect(resolveLeftTreePlacementIds(workbench)).toEqual([dashboardNavigationTreeViewId]);
  });

  test("opens saved views in the project sidebar mode", async () => {
    const workbench = createDashboardWorkbench();
    const view = await workbench.savedViews.create({
      name: "Review queue",
      resourceKind: "ticket",
      scope: "project",
      projectId: dashboardCollectionsProjectId,
      filter: filtersToExpression({ status: ["review"] }),
      display: settingsToDisplay({
        viewMode: "list",
        columnGrouping: "status",
        rowGrouping: "none",
        ordering: { field: "updated", direction: "desc" },
        displayProperties: ["id", "status", "updated"],
      }),
    });

    await workbench.resources.openResource(dashboardResources.settings, { replaceActive: true });
    await workbench.resources.openResource(createSavedViewResource(view), { replaceActive: true });

    expect(workbench.modes.getActiveModeId()).toBe("project");
    expect(resolveLeftTreePlacementIds(workbench)).toEqual([dashboardNavigationTreeViewId]);
    expect(workbench.layout.getLayout().activeWidgetId).toBe(dashboardWidgetIds.tickets);
  });

  test("opens workspaces from a data view into the resource sidebar", async () => {
    const workbench = createDashboardWorkbench();

    await workbench.resources.openResource(dashboardResources.workspaces, { replaceActive: true });

    const workspaceRenderer = workbench.renderers.getDataRenderer(dashboardWidgetIds.workspaces);
    expect(workspaceRenderer).toBeDefined();
    expect(workbench.layout.getLayout().activeWidgetId).toBe(dashboardWidgetIds.workspaces);

    await workbench.resources.openResource(dashboardTickets[0].workspaceResource, { replaceActive: true });

    expect(resolveAreaPlacementIds(workbench, "left")).toEqual([dashboardWidgetIds.ticketSidebar]);
    expect(resolveLeftTreePlacementIds(workbench)).toEqual([dashboardWidgetIds.ticketSidebar]);
    await expect(workbench.renderers.getBody(dashboardWidgetIds.ticketSidebar)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "resource",
          nodes: expect.arrayContaining([expect.objectContaining({ id: dashboardTickets[0].workspaceResource.uri })]),
        }),
      ]),
    );
    expect(workbench.layout.getLayout().activeWidgetId).toBe(dashboardWidgetIds.workspace);
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
          ordering: { field: "updated", direction: "desc" },
          displayProperties: ["id", "status"],
        },
        filters: {},
      }) ?? [],
    );

    expect(ticketRow).toBeDefined();
    ticketRenderer?.onTicketClick?.(ticketRow);

    expect(resolveAreaPlacementIds(workbench, "left")).toEqual([dashboardWidgetIds.ticketSidebar]);
    expect(resolveLeftTreePlacementIds(workbench)).toEqual([dashboardWidgetIds.ticketSidebar]);
    expect(workbench.layout.getLayout().activeResourceUri).toBe(dashboardTickets[0].resource.uri);
    expect(workbench.renderers.getTreeState(dashboardWidgetIds.ticketSidebar).selectedNodeId).toBe(
      dashboardTickets[0].resource.uri,
    );

    await workbench.resources.openResource(dashboardTickets[0].workspaceResource, { replaceActive: true });

    expect(resolveAreaPlacementIds(workbench, "left")).toEqual([dashboardWidgetIds.ticketSidebar]);
    expect(resolveLeftTreePlacementIds(workbench)).toEqual([dashboardWidgetIds.ticketSidebar]);
    expect(workbench.layout.getLayout().activeResourceUri).toBe(dashboardTickets[0].workspaceResource.uri);
    expect(workbench.renderers.getTreeState(dashboardWidgetIds.ticketSidebar).selectedNodeId).toBe(
      dashboardTickets[0].workspaceResource.uri,
    );
  });
});
