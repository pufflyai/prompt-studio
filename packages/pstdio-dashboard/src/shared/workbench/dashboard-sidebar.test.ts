import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench/core";
import { selectDashboardNavigationResource } from "@/shared/app/navigation-state";
import { dashboardResources } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { registerSidebarContribution } from "./contributions/sidebar-tree-contributions";
import { registerDashboardSidebar } from "./dashboard-sidebar";

describe("registerDashboardSidebar", () => {
  test("reads resource sections only while a concrete resource is selected", async () => {
    const workbench = createWorkbenchCore();
    let resourceSectionReads = 0;

    workbench.modes.registerMode({ id: "workspace", label: "Workspace", activate: () => undefined });
    registerSidebarContribution(workbench, {
      id: "test.resource-sections",
      modes: ["workspace"],
      getSections: (_ctx, input) => {
        resourceSectionReads += 1;
        return [
          {
            id: "resource",
            nodes: [{ id: input.resource!.uri, label: input.resource!.label ?? input.resource!.uri }],
          },
        ];
      },
    });
    registerDashboardSidebar(workbench);
    workbench.modes.setActiveMode("workspace");

    expect(await workbench.renderers.getBody(dashboardWidgetIds.dashboardSidebar)).toEqual([]);
    expect(resourceSectionReads).toBe(0);

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
    expect(resourceSectionReads).toBe(1);

    selectDashboardNavigationResource(workbench, dashboardResources.workspaces);

    expect(await workbench.renderers.getBody(dashboardWidgetIds.dashboardSidebar)).toEqual([]);
    expect(resourceSectionReads).toBe(1);
  });
});
