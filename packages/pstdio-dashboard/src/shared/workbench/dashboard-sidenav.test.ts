import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench";
import { selectDashboardNavigationResource } from "@/shared/app/navigation-state";
import { dashboardResources } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { registerSidenavContribution } from "./contributions/sidenav-tree-contributions";
import { registerDashboardSidenav } from "./dashboard-sidenav";
import { registerNavigationOwningMode } from "./mode-navigation-ownership";

describe("registerDashboardSidenav", () => {
  test("keeps the sidenav hidden while a navigation-owning mode is active", () => {
    const workbench = createWorkbenchCore();

    workbench.modes.registerMode({ id: "lab", label: "Lab", activate: () => undefined });
    workbench.modes.registerMode({ id: "other", label: "Other", activate: () => undefined });
    const ownership = registerNavigationOwningMode("lab");
    registerDashboardSidenav(workbench);

    try {
      workbench.modes.setActiveMode("lab");
      expect(workbench.layout.getLayout().regions.sidenav.widgets).toEqual([]);

      workbench.modes.setActiveMode("other");
      expect(workbench.layout.getLayout().regions.sidenav.widgets.map((widget) => widget.contributionId)).toEqual([
        dashboardWidgetIds.dashboardSidenav,
      ]);
    } finally {
      ownership.dispose();
    }
  });

  test("defaults the Sessions group to expanded", () => {
    const workbench = createWorkbenchCore();

    registerDashboardSidenav(workbench);

    expect(workbench.renderers.getTreeState(dashboardWidgetIds.dashboardSidenav)).toMatchObject({
      expandedNodeIds: ["sessions"],
      expandedSectionIds: ["sessions"],
    });
  });

  test("reads mode sections without a concrete resource and passes one when selected", async () => {
    const workbench = createWorkbenchCore();
    const resourceReads: Array<string | undefined> = [];

    workbench.modes.registerMode({ id: "workspace", label: "Workspace", activate: () => undefined });
    registerSidenavContribution(workbench, {
      id: "test.resource-sections",
      modes: ["workspace"],
      getSections: (_ctx, input) => {
        resourceReads.push(input.resource?.uri);
        return [
          {
            id: "resource",
            nodes: [
              {
                id: input.resource?.uri ?? "aggregate",
                label: input.resource?.label ?? "Aggregate",
              },
            ],
          },
        ];
      },
    });
    registerDashboardSidenav(workbench);
    workbench.modes.setActiveMode("workspace");

    expect(await workbench.renderers.getBody(dashboardWidgetIds.dashboardSidenav)).toEqual([
      { id: "resource", nodes: [{ id: "aggregate", label: "Aggregate" }] },
    ]);
    expect(resourceReads).toEqual([undefined]);

    const workspace = {
      kind: "workspace",
      uri: "dashboard-workbench://workspace/workspace-1",
      id: "workspace-1",
      label: "Workspace 1",
    };
    selectDashboardNavigationResource(workbench, workspace);

    expect(await workbench.renderers.getBody(dashboardWidgetIds.dashboardSidenav)).toEqual([
      { id: "resource", nodes: [{ id: workspace.uri, label: workspace.label }] },
    ]);
    expect(resourceReads).toEqual([undefined, workspace.uri]);

    selectDashboardNavigationResource(workbench, dashboardResources.workspaces);

    expect(await workbench.renderers.getBody(dashboardWidgetIds.dashboardSidenav)).toEqual([
      { id: "resource", nodes: [{ id: "aggregate", label: "Aggregate" }] },
    ]);
    expect(resourceReads).toEqual([undefined, workspace.uri, undefined]);
  });
});
