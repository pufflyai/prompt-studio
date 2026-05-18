import { describe, expect, test } from "bun:test";
import { createWorkbenchCore, type WorkbenchCore } from "../../../core";
import { dashboardCollectionsTreeViewId } from "../collections/dashboard-collections";
import { createSavedViewResource, dashboardCollectionsProjectId } from "../collections/saved-view-resources";
import { filtersToExpression, settingsToDisplay } from "../collections/ticket-view-mapping";
import {
  dashboardNavigationTreeViewId,
  dashboardResources,
  dashboardSettingsNavigationTreeViewId,
  dashboardWidgetIds,
} from "../mock-data/data";
import { createDashboardExampleModule } from "../module";

const createDashboardWorkbench = () => {
  const workbench = createWorkbenchCore();
  workbench.registerModule(createDashboardExampleModule());
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

describe("dashboard workbench navigation", () => {
  test("switches the sidebar between project views and settings", async () => {
    const workbench = createDashboardWorkbench();

    expect(resolveLeftTreePlacementIds(workbench)).toContain(dashboardNavigationTreeViewId);
    expect(resolveLeftTreePlacementIds(workbench)).toContain(dashboardCollectionsTreeViewId);

    await workbench.resources.openResource(dashboardResources.settings, { replaceActive: true });

    expect(workbench.modes.getActiveModeId()).toBe("settings");
    expect(resolveLeftTreePlacementIds(workbench)).toContain(dashboardSettingsNavigationTreeViewId);

    await workbench.resources.openResource(dashboardResources.tickets, { replaceActive: true });

    expect(workbench.modes.getActiveModeId()).toBe("project");
    expect(resolveLeftTreePlacementIds(workbench)).toContain(dashboardCollectionsTreeViewId);
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
    expect(resolveLeftTreePlacementIds(workbench)).toContain(dashboardCollectionsTreeViewId);
    expect(workbench.layout.getLayout().activeWidgetId).toBe(dashboardWidgetIds.tickets);
  });
});
