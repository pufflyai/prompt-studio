import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench/core";
import { selectDashboardNavigationResource } from "@/shared/app/navigation-state";
import { dashboardResources } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { registerSidebarContribution } from "./contributions/sidebar-tree-contributions";
import { registerDashboardSidebar } from "./dashboard-sidebar";

describe("registerDashboardSidebar", () => {
  test("reads mode sections without a concrete resource and passes one when selected", async () => {
    const workbench = createWorkbenchCore();
    const resourceReads: Array<string | undefined> = [];

    workbench.modes.registerMode({ id: "workspace", label: "Workspace", activate: () => undefined });
    registerSidebarContribution(workbench, {
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
    registerDashboardSidebar(workbench);
    workbench.modes.setActiveMode("workspace");

    expect(await workbench.renderers.getBody(dashboardWidgetIds.dashboardSidebar)).toEqual([
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

    expect(await workbench.renderers.getBody(dashboardWidgetIds.dashboardSidebar)).toEqual([
      { id: "resource", nodes: [{ id: workspace.uri, label: workspace.label }] },
    ]);
    expect(resourceReads).toEqual([undefined, workspace.uri]);

    selectDashboardNavigationResource(workbench, dashboardResources.workspaces);

    expect(await workbench.renderers.getBody(dashboardWidgetIds.dashboardSidebar)).toEqual([
      { id: "resource", nodes: [{ id: "aggregate", label: "Aggregate" }] },
    ]);
    expect(resourceReads).toEqual([undefined, workspace.uri, undefined]);
  });
});
